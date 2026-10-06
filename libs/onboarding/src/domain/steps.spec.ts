import { blockingPublishCodes, nextPendingCode } from './steps';

describe('onboarding publish gate', () => {
  const done = (code: string) => ({ code, status: 'DONE' });

  it('lists branding, address, hours and catalog when nothing is ready', () => {
    expect(blockingPublishCodes([], 0)).toEqual([
      'configure_branding',
      'configure_address',
      'configure_hours',
      'import_catalog',
    ]);
  });

  it('ignores WhatsApp, couriers and training', () => {
    expect(
      blockingPublishCodes(
        [
          done('configure_branding'),
          done('configure_address'),
          done('configure_hours'),
          { code: 'connect_whatsapp', status: 'PENDING' },
          { code: 'create_couriers', status: 'PENDING' },
          { code: 'train_team', status: 'PENDING' },
        ],
        2,
      ),
    ).toEqual([]);
  });

  it('still requires an active product when the catalog step was skipped', () => {
    expect(
      blockingPublishCodes(
        [
          done('configure_branding'),
          done('configure_address'),
          done('configure_hours'),
          { code: 'import_catalog', status: 'SKIPPED' },
        ],
        0,
      ),
    ).toEqual(['import_catalog']);
  });

  it('points to the first pending step', () => {
    expect(
      nextPendingCode([
        done('create_tenant'),
        done('create_store'),
        { code: 'configure_branding', status: 'PENDING' },
      ]),
    ).toBe('configure_branding');
  });
});
