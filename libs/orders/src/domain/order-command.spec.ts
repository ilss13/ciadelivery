import { DomainException } from '@ciadelivery/shared';
import { assertSafeEventPayload } from './domain-event';
import {
  ORDER_COMMANDS,
  assertPickupCompletion,
  resolveOrderNote,
} from './order-command';

describe('order commands', () => {
  it('maps each operational command to a status and an event', () => {
    expect(ORDER_COMMANDS.accept).toMatchObject({
      to: 'ACCEPTED',
      eventType: 'order.accepted',
    });
    expect(ORDER_COMMANDS.reject.eventType).toBe('order.rejected');
    expect(ORDER_COMMANDS['start-preparation'].to).toBe('IN_PREPARATION');
    expect(ORDER_COMMANDS.ready.eventType).toBe('order.ready');
    expect(ORDER_COMMANDS.cancel).toMatchObject({
      to: 'CANCELLED',
      note: 'required',
    });
    expect(ORDER_COMMANDS['complete-pickup']).toMatchObject({
      to: 'DELIVERED',
      eventType: 'order.delivered',
      pickupOnly: true,
    });
  });

  it('requires a note only when cancelling', () => {
    expect(resolveOrderNote('optional', '  sem item  ')).toBe('sem item');
    expect(resolveOrderNote('optional', '   ')).toBeNull();
    expect(resolveOrderNote('none', 'ignorada')).toBeNull();
    expect(() => resolveOrderNote('required', '  ')).toThrow(DomainException);
  });

  it('refuses to complete a delivery without a courier', () => {
    expect(() => assertPickupCompletion('PICKUP')).not.toThrow();
    expect(() => assertPickupCompletion('DELIVERY')).toThrow(DomainException);
    try {
      assertPickupCompletion('DELIVERY');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'DELIVERY_REQUIRES_COURIER',
        statusCode: 409,
      });
    }
  });

  it('rejects a payload that carries a secret', () => {
    expect(() =>
      assertSafeEventPayload({
        orderId: 'order-1',
        status: 'NEW',
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeEventPayload({ trackingToken: 'opaque' }),
    ).toThrow('The domain event payload contains a secret');
    expect(() => assertSafeEventPayload({ password: 'secret' })).toThrow(
      'The domain event payload contains a secret',
    );
  });
});
