import { ScriptedLlmProvider } from '../domain/llm-provider';
import { AiConfigurations, AiTurns } from '../domain/ai-turns.port';
import {
  ConversationEvents,
  ConversationRecord,
  Conversations,
  TextDispatch,
} from '../domain/conversations.port';
import {
  OutboundMessageRecord,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { ConversationTools } from '../domain/conversation-tools';
import { ConversationOrders } from '../domain/conversation-orders.port';
import { AutomatedConversation } from './automated-conversation';

const receivedAt = new Date('2026-10-05T12:00:00.000Z');

describe('AutomatedConversation', () => {
  it('hands off a request for an attendant without calling the provider', async () => {
    const provider = new ScriptedLlmProvider([]);
    const context = setup(provider);

    await context.useCase.execute(input('quero atendente'));

    expect(provider.inputs).toHaveLength(0);
    expect(context.modes).toEqual(['HUMAN']);
    expect(context.outbound).toEqual([]);
    expect(context.notices).toEqual([
      expect.objectContaining({ mode: 'HUMAN', reason: 'customer_requested_human' }),
    ]);
  });

  it('blocks a response containing a BRL value and records BLOCKED', async () => {
    const provider = new ScriptedLlmProvider([
      { assistantMessage: 'fica R$ 10', toolCalls: [], confidence: 0.9 },
    ]);
    const context = setup(provider);

    await context.useCase.execute(input('quanto custa?'));

    expect(context.outbound).toEqual([
      expect.objectContaining({ body: expect.stringContaining('sempre validados') }),
    ]);
    expect(context.modes).toEqual(['HUMAN']);
    expect(context.recorded).toEqual([
      expect.objectContaining({ confidence: 0.9, outcome: 'BLOCKED' }),
    ]);
  });

  it('hands off low confidence without sending the model response', async () => {
    const provider = new ScriptedLlmProvider([
      { assistantMessage: 'talvez', toolCalls: [], confidence: 0.2 },
    ]);
    const context = setup(provider);

    await context.useCase.execute(input('vocês abrem hoje?'));

    expect(context.outbound).toEqual([
      expect.objectContaining({ body: expect.stringContaining('sempre validados') }),
    ]);
    expect(context.modes).toEqual(['HUMAN']);
    expect(context.recorded[0]).toEqual(
      expect.objectContaining({ confidence: 0.2, outcome: 'HANDOFF' }),
    );
  });

  it('does not call the provider when AI is disabled', async () => {
    const provider = new ScriptedLlmProvider([
      { assistantMessage: 'oi', toolCalls: [], confidence: 1 },
    ]);
    const context = setup(provider, false);

    await context.useCase.execute(input('oi'));

    expect(provider.inputs).toHaveLength(0);
    expect(context.outbound).toEqual([]);
  });

  it('executes tools and renders preview values instead of the model price', async () => {
    const provider = new ScriptedLlmProvider([
      {
        assistantMessage: '',
        toolCalls: [
          {
            id: 'search-1',
            name: 'search_catalog',
            arguments: { query: 'x-bacon' },
          },
          {
            id: 'preview-1',
            name: 'preview_order',
            arguments: {
              items: [],
              fulfillment: 'PICKUP',
              phone: '5511999999999',
              name: 'Ana',
            },
          },
        ],
        confidence: 0.9,
      },
      {
        assistantMessage: 'O total inventado é R$ 0,01',
        toolCalls: [],
        confidence: 0.9,
      },
    ]);
    const context = setup(provider);
    context.executeTool.mockImplementation(
      (_context: unknown, call: { name: string }) =>
        Promise.resolve(
          call.name === 'preview_order'
            ? {
                ok: true,
                previewToken: 'opaque',
                customerName: 'Ana',
                items: [{ name: 'X-Bacon', quantity: 2, options: [] }],
                subtotalCents: 4000,
                deliveryFeeCents: 0,
                totalCents: 4000,
              }
            : { ok: true, products: [] },
        ),
    );

    await context.useCase.execute(input('quero 2 x-bacon'));

    expect(provider.inputs).toHaveLength(2);
    expect(provider.inputs[1]?.toolResults).toHaveLength(2);
    expect(context.outbound[1]?.body).toContain('Total R$ 40,00');
    expect(context.outbound[1]?.body).not.toContain('0,01');
  });

  it('hands off when the model requests an unknown tool', async () => {
    const provider = new ScriptedLlmProvider([
      {
        assistantMessage: '',
        toolCalls: [{ id: 'create-1', name: 'create_order', arguments: {} }],
        confidence: 0.9,
      },
    ]);
    const context = setup(provider);

    await context.useCase.execute(input('crie o pedido'));

    expect(context.executeTool).not.toHaveBeenCalled();
    expect(context.modes).toEqual(['HUMAN']);
    expect(context.notices).toEqual([
      expect.objectContaining({ reason: 'UNKNOWN_TOOL' }),
    ]);
  });

  it('hands off after four tool rounds without a final message', async () => {
    const provider = new ScriptedLlmProvider(
      Array.from({ length: 5 }, (_, index) => ({
        assistantMessage: '',
        toolCalls: [
          {
            id: `search-${index}`,
            name: 'search_catalog',
            arguments: { query: 'lanche' },
          },
        ],
        confidence: 0.9,
      })),
    );
    const context = setup(provider);

    await context.useCase.execute(input('quero um lanche'));

    expect(provider.inputs).toHaveLength(5);
    expect(context.executeTool).toHaveBeenCalledTimes(4);
    expect(context.notices).toEqual([
      expect.objectContaining({ reason: 'TOOL_LOOP' }),
    ]);
  });

  it('creates an order only after an explicit confirmation', async () => {
    const provider = new ScriptedLlmProvider([]);
    const context = setup(provider);
    context.confirmOrder.mockResolvedValue({
      outcome: 'CREATED',
      orderId: 'order-1',
      orderNumber: 42,
      trackingPath: '/pedido/token',
      customerName: 'Ana',
    });

    await context.useCase.execute(input('sim'));

    expect(provider.inputs).toHaveLength(0);
    expect(context.confirmOrder).toHaveBeenCalledTimes(1);
    expect(context.outbound.at(-1)?.body).toContain('pedido 42');
    expect(context.outbound.at(-1)?.body).toContain('/pedido/token');
    expect(context.notices).toContainEqual(
      expect.objectContaining({ mode: 'HUMAN', reason: 'order_created' }),
    );
  });

  it('invalidates the preview when the customer cancels', async () => {
    const provider = new ScriptedLlmProvider([]);
    const context = setup(provider);

    await context.useCase.execute(input('não'));

    expect(context.cancelOrder).toHaveBeenCalledTimes(1);
    expect(context.confirmOrder).not.toHaveBeenCalled();
    expect(provider.inputs).toHaveLength(0);
    expect(context.outbound.at(-1)?.body).toContain('não foi criado');
  });
});

function setup(provider: ScriptedLlmProvider, aiEnabled = true) {
  const modes: string[] = [];
  const outbound: OutboundMessageRecord[] = [];
  const notices: object[] = [];
  const recorded: object[] = [];
  const conversation: ConversationRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    storeId: 'store-a',
    customerId: null,
    contactPhone: '5511999999999',
    contactName: null,
    mode: 'BOT',
    linkedOrderId: null,
    lastMessageAt: receivedAt,
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };
  const conversations = {
    findInStore: jest.fn().mockResolvedValue(conversation),
    recentMessages: jest.fn().mockResolvedValue([
      {
        id: 'message-in',
        direction: 'IN',
        author: 'CUSTOMER',
        body: 'mensagem',
        templateKey: null,
        status: 'SENT',
        createdAt: receivedAt,
      },
    ]),
    setMode: jest.fn().mockImplementation(
      (_tenant: string, _store: string, _id: string, mode: string) => {
        modes.push(mode);
        return Promise.resolve(true);
      },
    ),
    touch: jest.fn().mockResolvedValue(undefined),
  } as unknown as Conversations;
  const configurations = {
    find: jest.fn().mockResolvedValue({ aiEnabled, aiAutoReply: false }),
  } as unknown as AiConfigurations;
  const turns = {
    countSince: jest.fn().mockResolvedValue(0),
    record: jest.fn().mockImplementation((turn: object) => {
      recorded.push(turn);
      return Promise.resolve();
    }),
  } as unknown as AiTurns;
  const messages = {
    insert: jest.fn().mockImplementation((message: OutboundMessageRecord) => {
      outbound.push(message);
      return Promise.resolve('inserted');
    }),
    remove: jest.fn().mockResolvedValue(undefined),
  } as unknown as OutboundMessages;
  const dispatch = {
    enqueue: jest.fn().mockResolvedValue(undefined),
  } as unknown as TextDispatch;
  const events = {
    modeChanged: jest.fn().mockImplementation((notice: object) => {
      notices.push(notice);
      return Promise.resolve();
    }),
  } as unknown as ConversationEvents;
  const executeTool = jest.fn().mockResolvedValue({ ok: true });
  const tools = { execute: executeTool } as unknown as ConversationTools;
  const confirmOrder = jest.fn().mockResolvedValue({ outcome: 'MISSING' });
  const cancelOrder = jest.fn().mockResolvedValue(true);
  const orders = {
    confirm: confirmOrder,
    cancel: cancelOrder,
  } as unknown as ConversationOrders;
  return {
    useCase: new AutomatedConversation(
      conversations,
      configurations,
      turns,
      messages,
      dispatch,
      events,
      provider,
      tools,
      orders,
      { confidenceMin: 0.6 },
    ),
    modes,
    outbound,
    notices,
    recorded,
    executeTool,
    confirmOrder,
    cancelOrder,
  };
}

function input(body: string) {
  return {
    tenantId: 'tenant-a',
    storeId: 'store-a',
    conversationId: '11111111-1111-4111-8111-111111111111',
    body,
    receivedAt,
  };
}
