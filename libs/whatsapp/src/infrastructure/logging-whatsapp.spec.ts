import { LoggingWhatsAppProvider } from './whatsapp-providers';

describe('LoggingWhatsAppProvider', () => {
  it('returns a fake id and does not call the network', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error('network');
    };
    try {
      const provider = new LoggingWhatsAppProvider('app-secret');
      const sent = await provider.sendText({
        phoneNumberId: '111',
        accessToken: 'token-value',
        to: '5511999999999',
        body: 'oi',
      });
      expect(sent.id).toMatch(
        /^log-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(provider.outbox).toEqual([
        { kind: 'text', id: sent.id, to: '5511999999999' },
      ]);
      expect(JSON.stringify(provider.outbox)).not.toContain('token-value');
    } finally {
      globalThis.fetch = original;
    }
  });
});
