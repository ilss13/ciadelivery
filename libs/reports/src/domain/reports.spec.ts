import { averageTicketCents, ordersToCsv } from './reports';

describe('report figures', () => {
  it('truncates the average ticket and ignores a zero billable count', () => {
    expect(averageTicketCents(3000, 2)).toBe(1500);
    expect(averageTicketCents(1000, 3)).toBe(333);
    expect(averageTicketCents(0, 0)).toBe(0);
  });

  it('exports order columns without a phone or tracking token', () => {
    const csv = ordersToCsv(
      [
        {
          orderNumber: 12,
          createdAt: new Date('2026-10-05T15:00:00.000Z'),
          status: 'DELIVERED',
          totalCents: 1500,
          source: 'STOREFRONT',
          fulfillment: 'PICKUP',
        },
      ],
      'America/Sao_Paulo',
    );

    expect(csv).toContain('número;data;status;total;origem;tipo');
    expect(csv).toContain('12;05/10/2026 12:00;Entregue;15,00;Loja;Retirada');
    expect(csv.toLowerCase()).not.toContain('telefone');
    expect(csv.toLowerCase()).not.toContain('token');
  });
});
