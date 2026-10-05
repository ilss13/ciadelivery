export interface SendTextInput {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}

export interface SendTemplateInput {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters: readonly string[];
}

export interface ProviderMessageRef {
  id: string;
}

export interface ParsedWebhookMessage {
  phoneNumberId: string;
  externalId: string;
  from: string;
  body: string;
  contactName: string | null;
}

export interface ParsedWebhook {
  messages: ParsedWebhookMessage[];
}

export interface WhatsAppProvider {
  sendText(input: SendTextInput): Promise<ProviderMessageRef>;
  sendTemplate(input: SendTemplateInput): Promise<ProviderMessageRef>;
  parseWebhook(headers: Headers, rawBody: Buffer): ParsedWebhook;
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
}

export interface WhatsAppPhoneCheck {
  assertPhoneNumber(input: {
    phoneNumberId: string;
    accessToken: string;
  }): Promise<void>;
}

export const WHATSAPP = Symbol('WHATSAPP');
export const WHATSAPP_PHONE_CHECK = Symbol('WHATSAPP_PHONE_CHECK');
