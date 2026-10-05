import { DomainException } from '@ciadelivery/shared';
import { orderListBounds } from './order-list';

describe('orderListBounds', () => {
  it('keeps an inclusive window', () => {
    const bounds = orderListBounds(
      '2026-10-04T00:00:00.000Z',
      '2026-10-04T23:59:59.999Z',
    );
    expect(bounds.from?.toISOString()).toBe('2026-10-04T00:00:00.000Z');
    expect(bounds.to?.toISOString()).toBe('2026-10-04T23:59:59.999Z');
  });

  it('rejects a window that ends before it starts', () => {
    expect(() =>
      orderListBounds('2026-10-05T00:00:00.000Z', '2026-10-04T00:00:00.000Z'),
    ).toThrow(DomainException);
  });
});
