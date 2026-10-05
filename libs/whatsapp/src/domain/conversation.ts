export const CONVERSATION_MODES = ['BOT', 'HUMAN', 'PAUSED', 'CLOSED'] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export const MESSAGE_AUTHORS = ['CUSTOMER', 'USER', 'SYSTEM'] as const;

export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];

const ORDER_NUMBER = /#(\d{1,9})(?!\d)/g;

export function orderNumbersInText(body: string): number[] {
  const found: number[] = [];
  for (const match of body.matchAll(ORDER_NUMBER)) {
    const value = Number(match[1]);
    if (!Number.isInteger(value) || value <= 0 || found.includes(value)) {
      continue;
    }
    found.push(value);
  }
  return found;
}

export function modeAfterInbound(
  current: ConversationMode | null,
): ConversationMode {
  if (current === 'BOT' || current === 'PAUSED') {
    return current;
  }
  return 'HUMAN';
}

export function canonicalContactPhone(from: string): string | null {
  const digits = from.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 20) {
    return null;
  }
  return digits;
}

export function contactLabel(name: string | null | undefined): string | null {
  if (name === null || name === undefined) {
    return null;
  }
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, 120);
}

export function inboundBody(body: string): string {
  return body.replace(/\u0000/g, '').slice(0, 4000);
}
