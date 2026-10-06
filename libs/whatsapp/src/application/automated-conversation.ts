import { createHash, randomUUID } from 'node:crypto';
import { JsonLogger } from '@ciadelivery/shared';
import { containsPrice, requestsHuman, validConfidence } from '../domain/ai-guardrails';
import {
  AiConfigurations,
  AiTurnOutcome,
  AiTurns,
} from '../domain/ai-turns.port';
import {
  ConversationEvents,
  ConversationRecord,
  Conversations,
  TextDispatch,
} from '../domain/conversations.port';
import {
  ConversationOrders,
} from '../domain/conversation-orders.port';
import {
  CONVERSATION_TOOL_NAMES,
  ConversationToolResult,
  ConversationTools,
  PreviewToolResult,
  conversationToolDefinitions,
  isRecord,
} from '../domain/conversation-tools';
import { LlmInput, LlmProvider } from '../domain/llm-provider';
import {
  confirmedOrderMessage,
  formatOrderTotal,
} from '../domain/order-templates';
import { OutboundMessages } from '../domain/outbound-messages.port';

const DAILY_TURN_LIMIT = 30;
const TOOL_ROUND_LIMIT = 4;
const HANDOFF_MESSAGE =
  'Vou chamar uma pessoa da equipe para continuar seu atendimento.';
const OPERATIONAL_NOTICE =
  'Este atendimento pode montar seu pedido. Preços, disponibilidade e criação são sempre validados pela loja.';

export interface AutomatedConversationConfig {
  confidenceMin: number;
}

export class AutomatedConversation {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly conversations: Conversations,
    private readonly configurations: AiConfigurations,
    private readonly turns: AiTurns,
    private readonly outbound: OutboundMessages,
    private readonly dispatch: TextDispatch,
    private readonly events: ConversationEvents,
    private readonly provider: LlmProvider | null,
    private readonly tools: ConversationTools,
    private readonly orders: ConversationOrders,
    private readonly config: AutomatedConversationConfig,
  ) {}

  async execute(input: {
    tenantId: string;
    storeId: string;
    conversationId: string;
    body: string;
    receivedAt: Date;
  }): Promise<void> {
    const conversation = await this.conversations.findInStore(
      input.tenantId,
      input.storeId,
      input.conversationId,
    );
    if (conversation === null) {
      return;
    }

    if (requestsHuman(input.body)) {
      if (conversation.mode === 'BOT') {
        await this.handoff(input, 'customer_requested_human');
        await this.record(input, 1, 'HANDOFF', this.hash([{ body: input.body }]));
      } else {
        await this.notifyMode(input, 'HUMAN', 'customer_requested_human');
      }
      return;
    }

    const settings = await this.configurations.find(input.tenantId, input.storeId);
    if (settings === null || !settings.aiEnabled) {
      return;
    }

    let mode = conversation.mode;
    if (
      mode === 'HUMAN' &&
      settings.aiAutoReply &&
      conversation.linkedOrderId === null
    ) {
      await this.conversations.setMode(
        input.tenantId,
        input.storeId,
        input.conversationId,
        'BOT',
        input.receivedAt,
      );
      mode = 'BOT';
      await this.notifyMode(input, mode, 'auto_reply');
    }
    if (mode !== 'BOT') {
      return;
    }

    await this.ensureOperationalNotice(input);
    const confirmation = confirmationIntent(input.body);
    if (confirmation === 'CANCEL') {
      await this.orders.cancel(orderInput(input, conversation));
      await this.queueReply(
        input,
        'Tudo bem. O pedido não foi criado e a prévia foi cancelada.',
      );
      return;
    }
    if (confirmation === 'CONFIRM') {
      await this.confirm(input, conversation);
      return;
    }

    const history = await this.conversations.recentMessages(
      input.tenantId,
      input.conversationId,
      20,
    );
    const llmInput: LlmInput = {
      history: history
        .filter((message) => message.author !== 'SYSTEM')
        .slice(-20)
        .map((message) => ({
          role: message.direction === 'IN' ? 'customer' : 'assistant',
          content: message.body,
        })),
      tools: conversationToolDefinitions,
      toolResults: [],
    };
    const promptHash = this.hash(llmInput);
    const turnsToday = await this.turns.countSince(
      input.tenantId,
      input.conversationId,
      startOfUtcDay(input.receivedAt),
    );
    if (turnsToday >= DAILY_TURN_LIMIT) {
      await this.handoff(input, 'daily_limit');
      await this.record(input, 0, 'HANDOFF', promptHash);
      return;
    }
    if (this.provider === null) {
      await this.handoff(input, 'provider_unavailable', true);
      await this.record(input, 0, 'HANDOFF', promptHash);
      return;
    }

    let preview: PreviewToolResult | null = null;
    let toolResults: ConversationToolResult[] = [];
    for (let round = 0; round <= TOOL_ROUND_LIMIT; round += 1) {
      let result;
      try {
        result = await this.provider.complete({ ...llmInput, toolResults });
      } catch {
        this.logger.warn(
          'AI provider failed; conversation handed off',
          'AutomatedConversation',
        );
        await this.handoff(input, 'provider_failed');
        await this.record(input, 0, 'HANDOFF', promptHash);
        return;
      }
      if (!validConfidence(result.confidence)) {
        await this.handoff(input, 'invalid_confidence');
        await this.record(input, 0, 'BLOCKED', promptHash);
        return;
      }
      if (result.confidence < this.config.confidenceMin) {
        await this.handoff(input, 'low_confidence');
        await this.record(input, result.confidence, 'HANDOFF', promptHash);
        return;
      }
      if (result.toolCalls.length === 0) {
        if (preview !== null) {
          await this.queueReply(input, previewMessage(preview));
        } else if (containsPrice(result.assistantMessage)) {
          this.logger.warn('ai.price_stripped', 'AutomatedConversation');
          await this.handoff(input, 'price_blocked');
          await this.record(input, result.confidence, 'BLOCKED', promptHash);
          return;
        } else {
          await this.queueReply(input, result.assistantMessage);
        }
        await this.record(input, result.confidence, 'REPLIED', promptHash);
        return;
      }
      if (round === TOOL_ROUND_LIMIT) {
        await this.handoff(input, 'TOOL_LOOP');
        await this.record(input, result.confidence, 'HANDOFF', promptHash);
        return;
      }
      if (
        result.toolCalls.some(
          (call) =>
            !(CONVERSATION_TOOL_NAMES as readonly string[]).includes(call.name),
        )
      ) {
        await this.handoff(input, 'UNKNOWN_TOOL');
        await this.record(input, result.confidence, 'HANDOFF', promptHash);
        return;
      }
      try {
        const roundResults: ConversationToolResult[] = [];
        for (const call of result.toolCalls) {
          const value = await this.tools.execute(
            {
              tenantId: input.tenantId,
              storeId: input.storeId,
              conversationId: input.conversationId,
              contactPhone: conversation.contactPhone,
            },
            call,
          );
          roundResults.push({
            toolCallId: call.id,
            name: call.name,
            result: value,
          });
          if (call.name === 'preview_order' && isPreview(value)) {
            preview = value;
          }
        }
        toolResults = [...toolResults, ...roundResults];
      } catch {
        this.logger.warn('AI tool failed; conversation handed off', 'AutomatedConversation');
        await this.handoff(input, 'tool_failed');
        await this.record(input, result.confidence, 'HANDOFF', promptHash);
        return;
      }
    }
  }

  private async confirm(
    input: Parameters<AutomatedConversation['execute']>[0],
    conversation: ConversationRecord,
  ): Promise<void> {
    let result;
    try {
      result = await this.orders.confirm(orderInput(input, conversation));
    } catch {
      await this.handoff(input, 'tool_failed', true);
      return;
    }
    switch (result.outcome) {
      case 'MISSING':
        await this.queueReply(
          input,
          'Não encontrei uma prévia válida. Vamos montar o pedido novamente.',
        );
        return;
      case 'EXPIRED':
        await this.queueReply(
          input,
          'A prévia expirou. Vamos montar o pedido novamente antes de confirmar.',
        );
        if (result.repeated) {
          await this.handoff(input, 'PREVIEW_EXPIRED');
        }
        return;
      case 'PAYMENT_REQUIRED':
        await this.queueReply(
          input,
          'A forma de pagamento em dinheiro não está disponível. Uma pessoa da equipe vai continuar o atendimento.',
        );
        await this.handoff(input, 'PAYMENT_REQUIRED');
        return;
      case 'TOOL_FAILED':
        await this.handoff(input, 'tool_failed', true);
        return;
      case 'PRICE_CHANGED':
        await this.queueReply(input, previewMessage(result.preview));
        return;
      case 'CREATED':
        await this.queueReply(
          input,
          confirmedOrderMessage(result),
        );
        await this.notifyMode(input, 'HUMAN', 'order_created');
        return;
    }
  }

  private async ensureOperationalNotice(
    input: Parameters<AutomatedConversation['execute']>[0],
  ): Promise<void> {
    const messages = await this.conversations.recentMessages(
      input.tenantId,
      input.conversationId,
      20,
    );
    if (
      messages.some(
        (message) =>
          message.direction === 'OUT' && message.body === OPERATIONAL_NOTICE,
      )
    ) {
      return;
    }
    await this.queueReply(input, OPERATIONAL_NOTICE);
  }

  private async handoff(
    input: Parameters<AutomatedConversation['execute']>[0],
    reason: string,
    notifyCustomer = false,
  ): Promise<void> {
    await this.conversations.setMode(
      input.tenantId,
      input.storeId,
      input.conversationId,
      'HUMAN',
      new Date(),
    );
    await this.notifyMode(input, 'HUMAN', reason);
    if (notifyCustomer) {
      await this.queueReply(input, HANDOFF_MESSAGE);
    }
  }

  private notifyMode(
    input: Parameters<AutomatedConversation['execute']>[0],
    mode: 'BOT' | 'HUMAN',
    reason: string,
  ): Promise<void> {
    return this.events.modeChanged({
      storeId: input.storeId,
      conversationId: input.conversationId,
      mode,
      reason,
    });
  }

  private async queueReply(
    input: Parameters<AutomatedConversation['execute']>[0],
    body: string,
  ): Promise<void> {
    const id = randomUUID();
    const createdAt = new Date();
    const inserted = await this.outbound.insert({
      id,
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      direction: 'OUT',
      author: 'BOT',
      toPhone: (
        await this.conversations.findInStore(
          input.tenantId,
          input.storeId,
          input.conversationId,
        )
      )?.contactPhone ?? '',
      templateKey: null,
      body,
      status: 'QUEUED',
      providerMessageId: null,
      eventId: null,
      externalId: null,
      lastError: null,
      createdAt,
    });
    if (inserted === 'duplicate') {
      return;
    }
    try {
      await this.dispatch.enqueue(id);
      await this.conversations.touch(input.tenantId, input.conversationId, createdAt);
    } catch {
      await this.outbound.remove(id, input.tenantId);
      this.logger.error('AI reply was not queued', undefined, 'AutomatedConversation');
    }
  }

  private record(
    input: Parameters<AutomatedConversation['execute']>[0],
    confidence: number,
    outcome: AiTurnOutcome,
    promptHash: string,
  ): Promise<void> {
    return this.turns.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      confidence,
      outcome,
      promptHash,
      createdAt: new Date(),
    });
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}

function isPreview(value: unknown): value is PreviewToolResult {
  if (!isRecord(value) || value['ok'] !== true) {
    return false;
  }
  return (
    typeof value['previewToken'] === 'string' &&
    typeof value['customerName'] === 'string' &&
    Array.isArray(value['items']) &&
    typeof value['subtotalCents'] === 'number' &&
    typeof value['deliveryFeeCents'] === 'number' &&
    typeof value['totalCents'] === 'number'
  );
}

function previewMessage(preview: PreviewToolResult): string {
  const items = preview.items
    .map((item) => {
      const options =
        item.options.length === 0 ? 'sem adicionais' : item.options.join(', ');
      return `${item.quantity} ${item.name} (${options})`;
    })
    .join(', ');
  return `${preview.customerName}, ficou ${items}.
Subtotal ${formatOrderTotal(preview.subtotalCents)}
Taxa ${formatOrderTotal(preview.deliveryFeeCents)}
Total ${formatOrderTotal(preview.totalCents)}
Responda SIM para confirmar ou NÃO para cancelar.`;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function confirmationIntent(value: string): 'CONFIRM' | 'CANCEL' | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (['sim', 'confirmo', 'pode'].includes(normalized)) {
    return 'CONFIRM';
  }
  if (['nao', 'cancela'].includes(normalized)) {
    return 'CANCEL';
  }
  return null;
}

function orderInput(
  input: Parameters<AutomatedConversation['execute']>[0],
  conversation: ConversationRecord,
) {
  return {
    tenantId: input.tenantId,
    storeId: input.storeId,
    conversationId: input.conversationId,
    contactPhone: conversation.contactPhone,
    contactName: conversation.contactName,
  };
}
