import {
  MetaCloudWhatsAppProvider,
  phoneUrl,
} from './whatsapp-providers';

describe('MetaCloudWhatsAppProvider', () => {
  const token = 'eaab-secret-token';

  it('checks the phone number on the Graph API without putting the token in the URL', async () => {
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get('authorization') });
      expect(url).not.toContain(token);
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const provider = new MetaCloudWhatsAppProvider(
      'v21.0',
      'app-secret',
      fetchImpl,
    );

    await provider.assertPhoneNumber({
      phoneNumberId: '106540352242922',
      accessToken: token,
    });

    expect(calls).toEqual([
      {
        url: phoneUrl('v21.0', '106540352242922'),
        authorization: `Bearer ${token}`,
      },
    ]);
  });

  it('reports an unapproved template without sending free text', async () => {
    const calls: string[] = [];
    const provider = new MetaCloudWhatsAppProvider('v21.0', 'app-secret', (input) => {
      calls.push(String(input));
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 132001, message: 'template' } }), {
          status: 400,
        }),
      );
    });
    await expect(
      provider.sendTemplate({
        phoneNumberId: '106540352242922',
        accessToken: token,
        to: '5511999999999',
        templateName: 'order_accepted',
        languageCode: 'pt_BR',
        bodyParameters: ['Ana', '12', 'Pizzaria', 'R$ 39,90', 'aceito'],
      }),
    ).rejects.toMatchObject({ code: 'TEMPLATE_NOT_APPROVED' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain(token);
  });

  it('rejects a phone number the Graph API does not accept', async () => {
    const provider = new MetaCloudWhatsAppProvider(
      'v21.0',
      'app-secret',
      () => Promise.resolve(new Response('', { status: 400 })),
    );
    await expect(
      provider.assertPhoneNumber({
        phoneNumberId: '106540352242922',
        accessToken: token,
      }),
    ).rejects.toMatchObject({ code: 'WHATSAPP_NUMBER_REJECTED' });
  });
});
