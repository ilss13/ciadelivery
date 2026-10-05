import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { WhatsAppConnections } from '../domain/connections.port';
import {
  decodeCredentialsKey,
  decryptCredentials,
} from '../domain/credentials-cipher';
import {
  OutboundMessageRecord,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { whatsAppSendLog, WhatsAppSendOutcome } from '../domain/send-log';
import { recordWhatsAppMetric } from './whatsapp-metrics';
import { WhatsAppProvider } from '../domain/whatsapp-provider';

const TERMINAL = new Set(['SENT', 'FAILED', 'SKIPPED']);

export class SendQueuedText {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly messages: OutboundMessages,
    private readonly connections: WhatsAppConnections,
    private readonly whatsapp: WhatsAppProvider,
    private readonly encryptionKey: string,
  ) {}

  async execute(messageId: string, attempt: number): Promise<void> {
    const message = await this.messages.findById(messageId);
    if (
      message === null ||
      message.direction !== 'OUT' ||
      message.author !== 'USER' ||
      TERMINAL.has(message.status)
    ) {
      return;
    }

    const connection = await this.connections.findConnectedForTenant(message.tenantId);
    if (
      connection === null ||
      connection.tenantId !== message.tenantId ||
      connection.encryptedCredentials === null
    ) {
      await this.messages.markFailed(
        message.id,
        message.tenantId,
        'WHATSAPP_NOT_CONNECTED',
      );
      this.record(message, attempt, 'failed');
      return;
    }

    try {
      const sent = await this.whatsapp.sendText({
        phoneNumberId: connection.phoneNumberId,
        accessToken: this.token(connection.encryptedCredentials),
        to: message.toPhone,
        body: message.body,
      });
      await this.messages.markSent(message.id, message.tenantId, sent.id);
      this.record(message, attempt, 'sent');
    } catch (error) {
      if (attempt >= 5) {
        await this.messages.markFailed(
          message.id,
          message.tenantId,
          publicError(error),
        );
        this.record(message, attempt, 'failed');
        return;
      }
      this.record(message, attempt, 'retry');
      throw error;
    }
  }

  private record(
    message: OutboundMessageRecord,
    attempt: number,
    outcome: WhatsAppSendOutcome,
  ): void {
    this.logger.log(
      whatsAppSendLog({
        tenantId: message.tenantId,
        messageId: message.id,
        templateKey: message.templateKey,
        attempt,
        outcome,
        phone: message.toPhone,
        body: message.body,
      }),
      'SendQueuedText',
    );
    recordWhatsAppMetric(outcome);
  }

  private token(encrypted: string): string {
    const key = decodeCredentialsKey(this.encryptionKey);
    if (key === null) {
      throw new Error('WHATSAPP_ENCRYPTION_UNAVAILABLE');
    }
    return decryptCredentials(encrypted, key);
  }
}

function publicError(error: unknown): string {
  if (error instanceof DomainException) {
    return error.code;
  }
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'WHATSAPP_SEND_FAILED';
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}
