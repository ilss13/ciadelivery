import { DomainException } from '@ciadelivery/shared';
import {
  ORDER_STATUSES,
  OrderStateMachine,
  OrderStatus,
  assertCanTransition,
} from './order-status';

const ALLOWED: readonly (readonly [OrderStatus, OrderStatus])[] = [
  ['NEW', 'ACCEPTED'],
  ['NEW', 'REJECTED'],
  ['NEW', 'CANCELLED'],
  ['ACCEPTED', 'IN_PREPARATION'],
  ['ACCEPTED', 'CANCELLED'],
  ['IN_PREPARATION', 'READY'],
  ['IN_PREPARATION', 'CANCELLED'],
  ['READY', 'OUT_FOR_DELIVERY'],
  ['READY', 'DELIVERED'],
  ['OUT_FOR_DELIVERY', 'DELIVERED'],
];

describe('OrderStateMachine', () => {
  const machine = new OrderStateMachine();

  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(() => machine.assertCanTransition(from, to)).not.toThrow();
    expect(() => assertCanTransition(from, to)).not.toThrow();
  });

  it('rejects every transition outside the table', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const allowed = ALLOWED.some(
          ([source, target]) => source === from && target === to,
        );
        if (allowed) {
          continue;
        }
        expect(() => assertCanTransition(from, to)).toThrow(DomainException);
        try {
          assertCanTransition(from, to);
        } catch (error) {
          expect(error).toMatchObject({
            code: 'ORDER_INVALID_TRANSITION',
            statusCode: 409,
            message: 'The requested order transition is not allowed',
          });
        }
      }
    }
  });
});
