import { DomainException } from '@ciadelivery/shared';
import {
  assertCanDeliver,
  assertCanDispatch,
  assertCourierAssignable,
  assertOrderAssignable,
} from './assignment';

describe('delivery assignment', () => {
  it('assigns only a ready delivery to an active courier', () => {
    expect(() =>
      assertOrderAssignable({ fulfillment: 'DELIVERY', status: 'READY' }),
    ).not.toThrow();
    expect(() =>
      assertOrderAssignable({ fulfillment: 'PICKUP', status: 'READY' }),
    ).toThrow(DomainException);
    expect(() =>
      assertOrderAssignable({ fulfillment: 'DELIVERY', status: 'ACCEPTED' }),
    ).toThrow(DomainException);
    expect(() => assertCourierAssignable(null)).toThrow(DomainException);
    expect(() => assertCourierAssignable({ active: false })).toThrow(
      DomainException,
    );
    expect(() => assertCourierAssignable({ active: true })).not.toThrow();
  });

  it('dispatches only an assigned ready delivery and delivers it on the route', () => {
    expect(() => assertCanDispatch({ fulfillment: 'DELIVERY', status: 'READY' }, null)).toThrow(
      DomainException,
    );
    try {
      assertCanDispatch({ fulfillment: 'DELIVERY', status: 'READY' }, null);
    } catch (error) {
      expect(error).toMatchObject({ code: 'COURIER_REQUIRED', statusCode: 409 });
    }
    expect(() =>
      assertCanDispatch(
        { fulfillment: 'DELIVERY', status: 'READY' },
        { status: 'ASSIGNED' },
      ),
    ).not.toThrow();
    expect(() =>
      assertCanDeliver({ fulfillment: 'DELIVERY', status: 'OUT_FOR_DELIVERY' }),
    ).not.toThrow();
    expect(() =>
      assertCanDeliver({ fulfillment: 'DELIVERY', status: 'READY' }),
    ).toThrow(DomainException);
  });
});
