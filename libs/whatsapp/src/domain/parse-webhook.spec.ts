import { parseWhatsAppWebhook } from './parse-webhook';

describe('parseWhatsAppWebhook', () => {
  it('reads each message id and the phone number id', () => {
    const raw = Buffer.from(
      JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '111' },
                  messages: [{ id: 'wamid.A' }, { id: 'wamid.B' }],
                },
              },
            ],
          },
        ],
      }),
      'utf8',
    );

    expect(parseWhatsAppWebhook(raw)).toEqual({
      messages: [
        {
          phoneNumberId: '111',
          externalId: 'wamid.A',
          from: '',
          body: '',
          contactName: null,
        },
        {
          phoneNumberId: '111',
          externalId: 'wamid.B',
          from: '',
          body: '',
          contactName: null,
        },
      ],
    });
  });

  it('reads the sender, the text and the profile name', () => {
    const raw = Buffer.from(
      JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '111' },
                  contacts: [
                    { wa_id: '5511999999999', profile: { name: 'Ana' } },
                  ],
                  messages: [
                    {
                      id: 'wamid.T',
                      from: '5511999999999',
                      type: 'text',
                      text: { body: 'oi #12' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
      'utf8',
    );
    expect(parseWhatsAppWebhook(raw).messages).toEqual([
      {
        phoneNumberId: '111',
        externalId: 'wamid.T',
        from: '5511999999999',
        body: 'oi #12',
        contactName: 'Ana',
      },
    ]);
  });

  it('returns no messages when the payload has only statuses', () => {
    const raw = Buffer.from(
      JSON.stringify({
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.S' }] } }] }],
      }),
      'utf8',
    );
    expect(parseWhatsAppWebhook(raw)).toEqual({ messages: [] });
  });

  it('rejects a body that is not JSON', () => {
    expect(() => parseWhatsAppWebhook(Buffer.from('not-json', 'utf8'))).toThrow(
      'INVALID_WHATSAPP_PAYLOAD',
    );
  });
});
