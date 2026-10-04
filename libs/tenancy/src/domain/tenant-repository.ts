import { Tenant } from './tenant';
import { TransactionContext } from './transaction-context';

export interface TenantRepository {
  insert(tenant: Tenant, tx: TransactionContext): Promise<void>;
  update(tenant: Tenant, tx: TransactionContext): Promise<void>;
  findById(id: string, tx?: TransactionContext): Promise<Tenant | null>;
  findBySlug(slug: string, tx?: TransactionContext): Promise<Tenant | null>;
  findByCustomDomain(
    domain: string,
    tx?: TransactionContext,
  ): Promise<Tenant | null>;
  list(
    page: number,
    pageSize: number,
  ): Promise<{ items: Tenant[]; total: number }>;
}

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');
