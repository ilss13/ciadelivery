import { TransactionContext } from '@ciadelivery/tenancy/domain';

export interface DomainEventDraft {
  id: string;
  tenantId: string;
  aggregateType: 'order';
  aggregateId: string;
  type: string;
  payload: Readonly<Record<string, string | number>>;
  availableAt: Date;
}

export interface DomainEventPublisher {
  publish(event: DomainEventDraft, tx: TransactionContext): Promise<void>;
}

export const DOMAIN_EVENTS = Symbol('DOMAIN_EVENTS');

const SECRET_KEY = /password|secret|token/i;

export function assertSafeEventPayload(
  payload: Readonly<Record<string, string | number>>,
): void {
  for (const key of Object.keys(payload)) {
    if (SECRET_KEY.test(key)) {
      throw new Error('The domain event payload contains a secret');
    }
  }
}
