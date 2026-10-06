import { PilotStatusReader } from '../domain/pilot-status';
import { ReadPilotStatus } from './read-pilot-status';

describe('ReadPilotStatus', () => {
  it('reads the seven-day window without exposing message content', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        tenantId: 'tenant-1',
        name: 'Loja',
        slug: 'loja',
        published: true,
        pendingSteps: ['train_team'],
        storefrontOrdersLast7Days: 3,
        failedWhatsAppMessages: 1,
      },
    ]);
    const reader: PilotStatusReader = { list };
    const useCase = new ReadPilotStatus(
      reader,
      () => new Date('2026-10-05T12:00:00.000Z'),
    );

    await expect(useCase.execute()).resolves.toEqual({
      generatedAt: '2026-10-05T12:00:00.000Z',
      windowDays: 7,
      tenants: [
        expect.objectContaining({
          tenantId: 'tenant-1',
          storefrontOrdersLast7Days: 3,
          failedWhatsAppMessages: 1,
        }),
      ],
    });
    expect(list).toHaveBeenCalledWith(new Date('2026-09-28T12:00:00.000Z'));
  });
});
