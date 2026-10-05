import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import {
  TemplateNotApprovedError,
  isTemplateNotApprovedPayload,
} from '../domain/template-approval';
import { parseWhatsAppWebhook } from '../domain/parse-webhook';
import { verifyMetaSignature } from '../domain/webhook-signature';
import {
  ParsedWebhook,
  ProviderMessageRef,
  SendTemplateInput,
  SendTextInput,
  WhatsAppPhoneCheck,
  WhatsAppProvider,
} from '../domain/whatsapp-provider';

interface LoggedMessage {
  kind: 'text' | 'template';
  id: string;
  to: string;
}

export class LoggingWhatsAppProvider
  implements WhatsAppProvider, WhatsAppPhoneCheck
{
  readonly outbox: LoggedMessage[] = [];

  constructor(private readonly appSecret: string) {}

  sendText(input: SendTextInput): Promise<ProviderMessageRef> {
    return Promise.resolve(this.remember('text', input.to));
  }

  sendTemplate(input: SendTemplateInput): Promise<ProviderMessageRef> {
    return Promise.resolve(this.remember('template', input.to));
  }

  parseWebhook(_headers: Headers, rawBody: Buffer): ParsedWebhook {
    return parseWhatsAppWebhook(rawBody);
  }

  verifySignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    return verifyMetaSignature(rawBody, signatureHeader, this.appSecret);
  }

  assertPhoneNumber(): Promise<void> {
    return Promise.resolve();
  }

  private remember(kind: LoggedMessage['kind'], to: string): ProviderMessageRef {
    const id = `log-${randomUUID()}`;
    this.outbox.push({ kind, id, to });
    return { id };
  }
}

const GRAPH_ORIGIN = 'https://graph.facebook.com';
const REQUEST_TIMEOUT_MS = 5000;

export class MetaCloudWhatsAppProvider
  implements WhatsAppProvider, WhatsAppPhoneCheck
{
  private readonly logger = new JsonLogger();

  constructor(
    private readonly graphVersion: string,
    private readonly appSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendText(input: SendTextInput): Promise<ProviderMessageRef> {
    return this.postMessage(input.phoneNumberId, input.accessToken, {
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'text',
      text: { body: input.body },
    }, false);
  }

  async sendTemplate(input: SendTemplateInput): Promise<ProviderMessageRef> {
    return this.postMessage(
      input.phoneNumberId,
      input.accessToken,
      {
        messaging_product: 'whatsapp',
        to: input.to,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.languageCode },
          components: [
            {
              type: 'body',
              parameters: input.bodyParameters.map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      },
      true,
    );
  }

  parseWebhook(_headers: Headers, rawBody: Buffer): ParsedWebhook {
    return parseWhatsAppWebhook(rawBody);
  }

  verifySignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    return verifyMetaSignature(rawBody, signatureHeader, this.appSecret);
  }

  async assertPhoneNumber(input: {
    phoneNumberId: string;
    accessToken: string;
  }): Promise<void> {
    const url = phoneUrl(this.graphVersion, input.phoneNumberId);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      this.logger.warn(
        `WhatsApp phone lookup failed for ${input.phoneNumberId}`,
        'MetaCloudWhatsAppProvider',
      );
      throw unavailable();
    }

    if (!response.ok) {
      this.logger.warn(
        `WhatsApp phone lookup rejected ${input.phoneNumberId} with status ${response.status}`,
        'MetaCloudWhatsAppProvider',
      );
      throw new DomainException(
        'WHATSAPP_NUMBER_REJECTED',
        'The WhatsApp number could not be verified',
        422,
      );
    }
  }

  private async postMessage(
    phoneNumberId: string,
    accessToken: string,
    body: unknown,
    template: boolean,
  ): Promise<ProviderMessageRef> {
    const url = `${phoneUrl(this.graphVersion, phoneNumberId)}/messages`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw unavailable();
    }

    if (!response.ok) {
      if (template && (await templateRejected(response))) {
        throw new TemplateNotApprovedError();
      }
      throw new DomainException(
        'WHATSAPP_SEND_FAILED',
        'The WhatsApp message was not accepted',
        502,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw unavailable();
    }

    const id = readMessageId(payload);
    if (id === undefined) {
      throw unavailable();
    }
    return { id };
  }
}

export function phoneUrl(graphVersion: string, phoneNumberId: string): string {
  return `${GRAPH_ORIGIN}/${graphVersion}/${encodeURIComponent(phoneNumberId)}`;
}

function readMessageId(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') {
    return undefined;
  }
  const messages = (payload as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return undefined;
  }
  const first = messages[0] as { id?: unknown };
  return typeof first.id === 'string' && first.id.length > 0
    ? first.id
    : undefined;
}

async function templateRejected(response: Response): Promise<boolean> {
  try {
    return isTemplateNotApprovedPayload(await response.clone().json());
  } catch {
    return false;
  }
}

function unavailable(): DomainException {
  return new DomainException(
    'WHATSAPP_PROVIDER_UNAVAILABLE',
    'The WhatsApp provider is unavailable',
    503,
  );
}
