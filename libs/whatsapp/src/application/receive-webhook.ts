import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { InboundWhatsApp } from './inbound-whatsapp';
import { WhatsAppConnections } from '../domain/connections.port';
import { WhatsAppWebhookEvents } from '../domain/webhook-events.port';
import { constantTimeEqual } from '../domain/webhook-signature';
import { WhatsAppProvider } from '../domain/whatsapp-provider';

export class VerifyWhatsAppWebhook {
  constructor(private readonly verifyToken: string) {}

  matches(token: string | undefined): boolean {
    if (this.verifyToken.length === 0 || token === undefined || token.length === 0) {
      return false;
    }
    return constantTimeEqual(token, this.verifyToken);
  }
}

export class ReceiveWhatsAppWebhook {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly connections: WhatsAppConnections,
    private readonly events: WhatsAppWebhookEvents,
    private readonly inbound: InboundWhatsApp,
  ) {}

  async execute(rawBody: Buffer, signatureHeader: string | undefined): Promise<void> {
    if (!this.provider.verifySignature(rawBody, signatureHeader)) {
      throw new DomainException(
        'WHATSAPP_SIGNATURE_INVALID',
        'The webhook signature is invalid',
        401,
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new DomainException(
        'WHATSAPP_PAYLOAD_INVALID',
        'The webhook payload is invalid',
        400,
      );
    }

    let parsed;
    try {
      parsed = this.provider.parseWebhook(new Headers(), rawBody);
    } catch {
      throw new DomainException(
        'WHATSAPP_PAYLOAD_INVALID',
        'The webhook payload is invalid',
        400,
      );
    }

    const receivedAt = new Date();
    for (const message of parsed.messages) {
      const connection = await this.connections.findConnectedByPhoneNumberId(
        message.phoneNumberId,
      );
      if (connection === null) {
        this.logger.warn(
          `WhatsApp webhook ignored unknown phone_number_id ${message.phoneNumberId}`,
          'ReceiveWhatsAppWebhook',
        );
        continue;
      }

      await this.inbound.execute(connection, message, receivedAt);
      await this.events.insertIfAbsent({
        id: randomUUID(),
        tenantId: connection.tenantId,
        externalId: message.externalId,
        payload,
        receivedAt,
      });
    }
  }
}
