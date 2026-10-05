export interface NewWhatsAppWebhookEvent {
  id: string;
  tenantId: string;
  externalId: string;
  payload: unknown;
  receivedAt: Date;
}

export interface WhatsAppWebhookEvents {
  insertIfAbsent(event: NewWhatsAppWebhookEvent): Promise<boolean>;
}

export const WHATSAPP_WEBHOOK_EVENTS = Symbol('WHATSAPP_WEBHOOK_EVENTS');
