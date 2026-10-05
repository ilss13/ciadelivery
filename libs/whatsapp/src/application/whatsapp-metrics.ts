import { observeCounter } from '@ciadelivery/shared';
import { WhatsAppSendOutcome } from '../domain/send-log';

export function recordWhatsAppMetric(outcome: WhatsAppSendOutcome): void {
  if (outcome === 'sent') {
    observeCounter('whatsapp_messages_sent');
  }
  if (outcome === 'failed') {
    observeCounter('whatsapp_messages_failed');
    observeCounter('jobs_failed', 'whatsapp-outbound');
  }
  if (outcome === 'retry') {
    observeCounter('jobs_retried', 'whatsapp-outbound');
  }
}
