import { maskPhone } from './order-templates';

export const WHATSAPP_SENDS_METRIC = 'whatsapp_sends_total';

export const WHATSAPP_SEND_OUTCOMES = [
  'sent',
  'failed',
  'retry',
  'skipped',
] as const;

export type WhatsAppSendOutcome = (typeof WHATSAPP_SEND_OUTCOMES)[number];

export interface WhatsAppSendLog {
  metric: typeof WHATSAPP_SENDS_METRIC;
  count: number;
  tenantId: string;
  messageId: string;
  templateKey: string | null;
  attempt: number;
  outcome: WhatsAppSendOutcome;
  phone: string;
  body?: string;
}

export interface WhatsAppSendLogInput {
  tenantId: string;
  messageId: string;
  templateKey: string | null;
  attempt: number;
  outcome: WhatsAppSendOutcome;
  phone: string;
  body: string;
  accessToken?: string;
}

let sendCount = 0;

export function whatsAppSendLog(input: WhatsAppSendLogInput): WhatsAppSendLog {
  sendCount += 1;
  const line: WhatsAppSendLog = {
    metric: WHATSAPP_SENDS_METRIC,
    count: sendCount,
    tenantId: input.tenantId,
    messageId: input.messageId,
    templateKey: input.templateKey,
    attempt: input.attempt,
    outcome: input.outcome,
    phone: maskPhone(input.phone),
  };
  if (!containsTrackingLink(input.body)) {
    line.body = input.body;
  }
  return line;
}

export function containsTrackingLink(body: string): boolean {
  return /\/pedido\/|[?&](?:token|tracking)=/i.test(body);
}

export function shortSendError(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length === 0) {
    return null;
  }
  if (compact.length <= 120) {
    return compact;
  }
  return `${compact.slice(0, 117)}...`;
}
