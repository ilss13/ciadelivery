import {
  formatOrderTotal,
  maskPhone,
  orderStatusMessage,
  templateKeyForEvent,
} from './order-templates';

describe('order status templates', () => {
  it('maps each order event to one template key', () => {
    expect(templateKeyForEvent('order.created')).toBe('order_received');
    expect(templateKeyForEvent('order.accepted')).toBe('order_accepted');
    expect(templateKeyForEvent('order.rejected')).toBe('order_rejected');
    expect(templateKeyForEvent('order.in_preparation')).toBe('order_preparing');
    expect(templateKeyForEvent('order.ready')).toBe('order_ready');
    expect(templateKeyForEvent('order.out_for_delivery')).toBe(
      'order_out_for_delivery',
    );
    expect(templateKeyForEvent('order.delivered')).toBe('order_delivered');
    expect(templateKeyForEvent('order.cancelled')).toBe('order_cancelled');
    expect(templateKeyForEvent('order.courier_assigned')).toBeUndefined();
  });

  it('formats cents and keeps the tracking token out of the text', () => {
    const body = orderStatusMessage({
      templateKey: 'order_received',
      customerName: 'Ana',
      orderNumber: 12,
      storeName: 'Pizzaria',
      totalCents: 3990,
      status: 'NEW',
    });
    expect(formatOrderTotal(3990)).toBe('R$ 39,90');
    expect(body).toContain('Ana');
    expect(body).toContain('pedido 12');
    expect(body).toContain('Pizzaria');
    expect(body).toContain('R$ 39,90');
    expect(body).toContain('Acompanhe pelo link da loja');
    expect(body).not.toContain('/pedido/');
  });

  it('masks every digit except the last four', () => {
    expect(maskPhone('5511999991234')).toBe('*********1234');
    expect(maskPhone('11999991234')).toBe('*******1234');
  });
});
