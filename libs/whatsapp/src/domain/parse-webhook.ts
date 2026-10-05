import { ParsedWebhook } from './whatsapp-provider';

export function parseWhatsAppWebhook(rawBody: Buffer): ParsedWebhook {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    throw new Error('INVALID_WHATSAPP_PAYLOAD');
  }

  if (!isRecord(parsed)) {
    throw new Error('INVALID_WHATSAPP_PAYLOAD');
  }

  const entry = parsed['entry'];
  if (!Array.isArray(entry)) {
    return { messages: [] };
  }

  const messages: ParsedWebhook['messages'] = [];
  for (const item of entry) {
    if (!isRecord(item) || !Array.isArray(item['changes'])) {
      continue;
    }
    for (const change of item['changes']) {
      collectMessages(change, messages);
    }
  }

  return { messages };
}

function collectMessages(
  change: unknown,
  messages: ParsedWebhook['messages'],
): void {
  if (!isRecord(change) || !isRecord(change['value'])) {
    return;
  }

  const value = change['value'];
  const metadata = value['metadata'];
  const phoneNumberId = isRecord(metadata)
    ? text(metadata['phone_number_id'])
    : undefined;
  const incoming = value['messages'];
  if (phoneNumberId === undefined || !Array.isArray(incoming)) {
    return;
  }

  const names = namesByWaId(value);
  for (const message of incoming) {
    if (!isRecord(message)) {
      continue;
    }
    const externalId = text(message['id']);
    if (externalId === undefined || externalId.length > 255) {
      continue;
    }
    if (phoneNumberId.length > 64) {
      continue;
    }
    const from = text(message['from']) ?? '';
    messages.push({
      phoneNumberId,
      externalId,
      from,
      body: messageBody(message),
      contactName: names.get(from) ?? null,
    });
  }
}

function namesByWaId(value: Record<string, unknown>): Map<string, string> {
  const names = new Map<string, string>();
  const contacts = value['contacts'];
  if (!Array.isArray(contacts)) {
    return names;
  }
  for (const contact of contacts) {
    if (!isRecord(contact)) {
      continue;
    }
    const waId = text(contact['wa_id']);
    const profile = contact['profile'];
    const name = isRecord(profile) ? text(profile['name']) : undefined;
    if (waId !== undefined && name !== undefined) {
      names.set(waId, name);
    }
  }
  return names;
}

function messageBody(message: Record<string, unknown>): string {
  const textBody = isRecord(message['text'])
    ? text(message['text']['body'])
    : undefined;
  if (textBody !== undefined) {
    return textBody.slice(0, 4000);
  }
  const button = isRecord(message['button'])
    ? text(message['button']['text'])
    : undefined;
  return button === undefined ? '' : button.slice(0, 4000);
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
