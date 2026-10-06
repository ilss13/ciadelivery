import {
  AutomatedConversation,
  ScriptedLlmProvider,
} from '@ciadelivery/whatsapp';

const at = new Date('2026-10-05T12:00:00.000Z');

describe('phase 9 acceptance', () => {
  it('previews with server values and creates a WhatsApp order only after SIM', async () => {
    const provider = new ScriptedLlmProvider([
      {
        assistantMessage: '',
        confidence: 1,
        toolCalls: [
          {
            id: 'preview',
            name: 'preview_order',
            arguments: {
              items: [
                { productId: 'product', quantity: 2, optionIds: [] },
              ],
              fulfillment: 'PICKUP',
              phone: '5511999999999',
              name: 'Ana',
            },
          },
        ],
      },
      {
        assistantMessage: 'total forjado R$ 0,01',
        confidence: 1,
        toolCalls: [],
      },
    ]);
    const harness = setup(provider);

    await harness.automated.execute(input('Quero 2 x-bacon'));

    expect(harness.orders).toHaveLength(0);
    expect(harness.outbound.at(-1)?.body).toContain('Total R$ 40,00');
    expect(harness.outbound.at(-1)?.body).not.toContain('0,01');

    await harness.automated.execute(input('sim'));

    expect(harness.orders).toEqual([
      expect.objectContaining({
        source: 'WHATSAPP',
        status: 'NEW',
        quantity: 2,
        unitPriceCents: 2000,
        totalCents: 4000,
      }),
    ]);
    expect(harness.outbound.at(-1)?.body).toContain('/pedido/token');
    expect(harness.conversation.mode).toBe('HUMAN');
  });

  it('does not create when the revalidated total changed', async () => {
    const harness = setup(new ScriptedLlmProvider([]), 5000);

    await harness.automated.execute(input('confirmo'));

    expect(harness.orders).toHaveLength(0);
    expect(harness.outbound.at(-1)?.body).toContain('Total R$ 50,00');
    expect(harness.outbound.at(-1)?.body).toContain('SIM');
  });

  it('hands off an attendant request without creating or calling the model', async () => {
    const provider = new ScriptedLlmProvider([]);
    const harness = setup(provider);

    await harness.automated.execute(input('quero atendente'));

    expect(provider.inputs).toHaveLength(0);
    expect(harness.orders).toHaveLength(0);
    expect(harness.modes).toEqual(['HUMAN']);
  });
});

function setup(provider: ScriptedLlmProvider, changedTotal?: number) {
  const outbound: Array<{ direction: 'OUT'; body: string }> = [];
  const modes: string[] = [];
  const orders: object[] = [];
  const conversation = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    storeId: 'store-a',
    customerId: null,
    contactPhone: '5511999999999',
    contactName: 'Ana',
    mode: 'BOT',
    linkedOrderId: null,
    lastMessageAt: at,
    createdAt: at,
    updatedAt: at,
  };
  const automated = new AutomatedConversation(
    {
      findInStore: jest.fn().mockResolvedValue(conversation),
      recentMessages: jest.fn().mockImplementation(() =>
        Promise.resolve([
          {
            id: 'inbound',
            direction: 'IN',
            author: 'CUSTOMER',
            body: 'mensagem',
            templateKey: null,
            status: 'SENT',
            createdAt: at,
          },
          ...outbound.map((message, index) => ({
            id: `out-${index}`,
            direction: 'OUT',
            author: 'BOT',
            body: message.body,
            templateKey: null,
            status: 'QUEUED',
            createdAt: at,
          })),
        ]),
      ),
      setMode: jest.fn().mockImplementation(
        (_tenant, _store, _id, mode: string) => {
          modes.push(mode);
          conversation.mode = mode as 'BOT';
          return Promise.resolve(true);
        },
      ),
      touch: jest.fn().mockResolvedValue(undefined),
    } as never,
    {
      find: jest
        .fn()
        .mockResolvedValue({ aiEnabled: true, aiAutoReply: false }),
    } as never,
    {
      countSince: jest.fn().mockResolvedValue(0),
      record: jest.fn().mockResolvedValue(undefined),
    } as never,
    {
      insert: jest.fn().mockImplementation((message) => {
        outbound.push(message);
        return Promise.resolve('inserted');
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    } as never,
    { enqueue: jest.fn().mockResolvedValue(undefined) } as never,
    { modeChanged: jest.fn().mockResolvedValue(undefined) } as never,
    provider,
    {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        previewToken: 'opaque',
        customerName: 'Ana',
        items: [{ name: 'X-Bacon', quantity: 2, options: [] }],
        subtotalCents: 4000,
        deliveryFeeCents: 0,
        totalCents: 4000,
      }),
    } as never,
    {
      cancel: jest.fn().mockResolvedValue(true),
      confirm: jest.fn().mockImplementation(() => {
        if (changedTotal !== undefined) {
          return Promise.resolve({
            outcome: 'PRICE_CHANGED',
            preview: {
              previewToken: 'new',
              customerName: 'Ana',
              items: [{ name: 'X-Bacon', quantity: 2, options: [] }],
              subtotalCents: changedTotal,
              deliveryFeeCents: 0,
              totalCents: changedTotal,
            },
          });
        }
        orders.push({
          source: 'WHATSAPP',
          status: 'NEW',
          quantity: 2,
          unitPriceCents: 2000,
          totalCents: 4000,
        });
        conversation.mode = 'HUMAN' as 'BOT';
        return Promise.resolve({
          outcome: 'CREATED',
          orderId: 'order-1',
          orderNumber: 42,
          trackingPath: '/pedido/token',
          customerName: 'Ana',
        });
      }),
    } as never,
    { confidenceMin: 0.6 },
  );
  return { automated, outbound, modes, orders, conversation };
}

function input(body: string) {
  return {
    tenantId: 'tenant-a',
    storeId: 'store-a',
    conversationId: '11111111-1111-4111-8111-111111111111',
    body,
    receivedAt: at,
  };
}
