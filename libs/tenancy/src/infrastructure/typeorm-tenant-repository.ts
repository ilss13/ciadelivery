import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Tenant } from '../domain/tenant';
import { TenantRepository } from '../domain/tenant-repository';
import { TransactionContext } from '../domain/transaction-context';
import { isMysqlDuplicate } from './mysql-error';
import { TenantEntity } from './tenant.entity';

@Injectable()
export class TypeOrmTenantRepository implements TenantRepository {
  constructor(private readonly database: DatabaseReady) {}

  async insert(tenant: Tenant, tx: TransactionContext): Promise<void> {
    const manager = await this.manager(tx);
    try {
      await manager.insert(TenantEntity, tenant);
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw new DomainException(
          'TENANT_SLUG_TAKEN',
          'The tenant slug is already in use',
          409,
        );
      }

      throw error;
    }
  }

  async update(tenant: Tenant, tx: TransactionContext): Promise<void> {
    const manager = await this.manager(tx);
    try {
      await manager.update(TenantEntity, tenant.id, {
        name: tenant.name,
        status: tenant.status,
        planCode: tenant.planCode,
        customDomain: tenant.customDomain,
        updatedAt: tenant.updatedAt,
      });
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw new DomainException(
          'TENANT_DOMAIN_TAKEN',
          'The custom domain is already in use',
          409,
        );
      }

      throw error;
    }
  }

  async findById(id: string, tx?: TransactionContext): Promise<Tenant | null> {
    const manager = await this.manager(tx);
    const row = await manager.findOne(TenantEntity, { where: { id } });
    return row === null ? null : toTenant(row);
  }

  async findBySlug(
    slug: string,
    tx?: TransactionContext,
  ): Promise<Tenant | null> {
    const manager = await this.manager(tx);
    const row = await manager.findOne(TenantEntity, { where: { slug } });
    return row === null ? null : toTenant(row);
  }

  async findByCustomDomain(
    domain: string,
    tx?: TransactionContext,
  ): Promise<Tenant | null> {
    const manager = await this.manager(tx);
    const row = await manager.findOne(TenantEntity, {
      where: { customDomain: domain },
    });
    return row === null ? null : toTenant(row);
  }

  async list(
    page: number,
    pageSize: number,
  ): Promise<{ items: Tenant[]; total: number }> {
    const manager = await this.manager();
    const [rows, total] = await manager.findAndCount(TenantEntity, {
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items: rows.map(toTenant), total };
  }

  private async manager(
    tx: TransactionContext | undefined = undefined,
  ): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    if (tx === undefined) {
      return dataSource.manager;
    }

    return tx as unknown as EntityManager;
  }
}

function toTenant(row: TenantEntity): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    planCode: row.planCode,
    customDomain: row.customDomain,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
