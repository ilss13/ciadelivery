import { CreateTenant } from './application/create-tenant';
import { StoreAddress, Stores } from './domain/stores.port';
import { TenantRepository } from './domain/tenant-repository';
import { UnitOfWork } from './domain/transaction-context';

const address: StoreAddress = {
  line: 'Rua A',
  number: '10',
  district: 'Centro',
  city: 'Sao Paulo',
  state: 'SP',
  postalCode: '01000-000',
};

function unusedUnitOfWork(): UnitOfWork {
  return {
    run: () => {
      throw new Error('transaction should not start');
    },
  };
}

describe('CreateTenant', () => {
  it('refuses a reserved slug before opening a transaction', async () => {
    const useCase = new CreateTenant(
      {} as TenantRepository,
      {} as Stores,
      unusedUnitOfWork(),
    );

    await expect(
      useCase.execute({
        name: 'Admin',
        slug: 'admin',
        phone: '11999999999',
        address,
      }),
    ).rejects.toMatchObject({
      code: 'TENANT_SLUG_RESERVED',
      statusCode: 409,
    });
  });
});
