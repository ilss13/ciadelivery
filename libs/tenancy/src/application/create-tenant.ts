import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { isValidCustomDomain } from '../domain/custom-domain';
import { Stores, StoreAddress } from '../domain/stores.port';
import { Tenant } from '../domain/tenant';
import { TenantRepository } from '../domain/tenant-repository';
import { isReservedTenantSlug, isValidTenantSlug } from '../domain/tenant-slug';
import { TransactionContext, UnitOfWork } from '../domain/transaction-context';

export interface CreateTenantCommand {
  name: string;
  slug: string;
  phone: string;
  address: StoreAddress;
}

export interface TenantWithStore {
  tenant: Tenant;
  store: Awaited<ReturnType<Stores['createInitialStore']>>;
}

type TenantChecklist = {
  seed(tenantId: string, tx: TransactionContext): Promise<void>;
};

export class CreateTenant {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly tenants: TenantRepository,
    private readonly stores: Stores,
    private readonly unitOfWork: UnitOfWork,
    private readonly checklist: TenantChecklist | null = null,
  ) {}

  async execute(command: CreateTenantCommand): Promise<TenantWithStore> {
    const slug = command.slug.trim().toLowerCase();
    if (!isValidTenantSlug(slug)) {
      throw new DomainException(
        'TENANT_SLUG_INVALID',
        'The tenant slug is invalid',
        400,
      );
    }

    if (isReservedTenantSlug(slug)) {
      throw new DomainException(
        'TENANT_SLUG_RESERVED',
        'The tenant slug is reserved',
        409,
      );
    }

    const now = new Date();
    const tenant: Tenant = {
      id: randomUUID(),
      name: command.name.trim(),
      slug,
      status: 'ACTIVE',
      planCode: 'STANDARD',
      customDomain: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.unitOfWork.run(async (tx) => {
      const existing = await this.tenants.findBySlug(slug, tx);
      if (existing !== null) {
        throw new DomainException(
          'TENANT_SLUG_TAKEN',
          'The tenant slug is already in use',
          409,
        );
      }

      await this.tenants.insert(tenant, tx);
      const store = await this.stores.createInitialStore(
        {
          tenantId: tenant.id,
          name: tenant.name,
          phone: command.phone.trim(),
          address: command.address,
        },
        tx,
      );
      if (this.checklist !== null) {
        await this.checklist.seed(tenant.id, tx);
      }
      this.logger.log(`Tenant created ${tenant.id}`, 'CreateTenant');
      return { tenant, store };
    });
  }
}

export function assertCustomDomain(
  domain: string,
  platformDomain: string,
): void {
  if (!isValidCustomDomain(domain, platformDomain)) {
    throw new DomainException(
      'TENANT_DOMAIN_INVALID',
      'The custom domain is invalid',
      400,
    );
  }
}
