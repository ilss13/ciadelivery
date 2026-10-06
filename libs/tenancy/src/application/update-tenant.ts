import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { Stores } from '../domain/stores.port';
import { Tenant, TenantStatus } from '../domain/tenant';
import { TenantRepository } from '../domain/tenant-repository';
import { TransactionContext, UnitOfWork } from '../domain/transaction-context';
import { TenantWithStore, assertCustomDomain } from './create-tenant';

export interface UpdateTenantCommand {
  id: string;
  name?: string;
  status?: TenantStatus;
  planCode?: string;
  customDomain?: string | null;
  platformDomain: string;
}

type DomainChecklist = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

export class UpdateTenant {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly tenants: TenantRepository,
    private readonly stores: Stores,
    private readonly unitOfWork: UnitOfWork,
    private readonly checklist: DomainChecklist | null = null,
  ) {}

  async execute(command: UpdateTenantCommand): Promise<TenantWithStore> {
    const updated = await this.unitOfWork.run(async (tx) => {
      const current = await this.tenants.findById(command.id, tx);
      if (current === null) {
        throw new DomainException(
          'TENANT_NOT_FOUND',
          'The tenant was not found',
          404,
        );
      }

      const next = applyUpdate(current, command);
      if (
        next.customDomain !== null &&
        next.customDomain !== current.customDomain
      ) {
        assertCustomDomain(next.customDomain, command.platformDomain);
        const owner = await this.tenants.findByCustomDomain(
          next.customDomain,
          tx,
        );
        if (owner !== null && owner.id !== next.id) {
          throw new DomainException(
            'TENANT_DOMAIN_TAKEN',
            'The custom domain is already in use',
            409,
          );
        }
      }

      await this.tenants.update(next, tx);
      if (command.customDomain !== undefined && this.checklist !== null) {
        await this.checklist.markDone(
          { tenantId: next.id, code: 'configure_domain', actorId: null },
          tx,
        );
      }
      return next;
    });

    const store = await this.stores.findByTenantId(updated.id);
    if (store === null) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    this.logger.log(`Tenant updated ${updated.id}`, 'UpdateTenant');
    return { tenant: updated, store };
  }
}

function applyUpdate(current: Tenant, command: UpdateTenantCommand): Tenant {
  return {
    ...current,
    name: command.name === undefined ? current.name : command.name.trim(),
    status: command.status === undefined ? current.status : command.status,
    planCode:
      command.planCode === undefined
        ? current.planCode
        : command.planCode.trim(),
    customDomain:
      command.customDomain === undefined
        ? current.customDomain
        : command.customDomain,
    updatedAt: new Date(),
  };
}
