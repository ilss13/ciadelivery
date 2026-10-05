import { shortSendError, whatsAppSendLog } from './send-log';

describe('whatsAppSendLog', () => {
  it('counts the send and keeps the template key when the body has a tracking link', () => {
    const tracking = 'Acompanhe em https://loja.localhost/pedido/secret-token?token=abc';
    const first = whatsAppSendLog({
      tenantId: 'tenant-a',
      messageId: 'message-1',
      templateKey: 'order_received',
      attempt: 3,
      outcome: 'sent',
      phone: '5511988887777',
      body: tracking,
      accessToken: 'store-token-value',
    });
    const second = whatsAppSendLog({
      tenantId: 'tenant-a',
      messageId: 'message-2',
      templateKey: 'order_accepted',
      attempt: 1,
      outcome: 'retry',
      phone: '11988887777',
      body: 'Ana, recebemos seu pedido.',
    });

    expect(first).toEqual({
      metric: 'whatsapp_sends_total',
      count: first.count,
      tenantId: 'tenant-a',
      messageId: 'message-1',
      templateKey: 'order_received',
      attempt: 3,
      outcome: 'sent',
      phone: '*********7777',
    });
    expect(first).not.toHaveProperty('body');
    expect(JSON.stringify(first)).not.toContain('secret-token');
    expect(JSON.stringify(first)).not.toContain('store-token-value');
    expect(JSON.stringify(first)).not.toContain('5511988887777');
    expect(second.body).toBe('Ana, recebemos seu pedido.');
    expect(second.phone).toBe('*******7777');
    expect(second.count).toBe(first.count + 1);
  });

  it('shortens a send error', () => {
    expect(shortSendError('  TEMPLATE_NOT_APPROVED  ')).toBe(
      'TEMPLATE_NOT_APPROVED',
    );
    expect(shortSendError(null)).toBeNull();
    expect(shortSendError('x'.repeat(121))).toBe(`${'x'.repeat(117)}...`);
  });
});