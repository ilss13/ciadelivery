import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CourierRecord, isCourierStatus } from '../domain/courier';
import {
  CourierListQuery,
  Couriers,
  NewCourier,
} from '../domain/couriers.port';
import { CourierEntity } from './courier.entities';

@Injectable()
export class TypeOrmCouriers implements Couriers {
  constructor(private readonly database: DatabaseReady) {}

  async insert(courier: NewCourier, tx: TransactionContext): Promise<void> {
    try {
      await managerOf(tx).insert(CourierEntity, courier);
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw new DomainException(
          'COURIER_ALREADY_EXISTS',
          'The user is already a courier',
          409,
        );
      }
      throw error;
    }
  }

  async update(courier: CourierRecord, tx: TransactionContext): Promise<void> {
    await managerOf(tx).update(
      CourierEntity,
      { id: courier.id, tenantId: courier.tenantId, storeId: courier.storeId },
      {
        name: courier.name,
        phone: courier.phone,
        status: courier.status,
        active: courier.active,
        vehicleType: courier.vehicleType,
        notes: courier.notes,
        updatedAt: courier.updatedAt,
      },
    );
  }

  async findInStore(
    tenantId: string,
    storeId: string,
    courierId: string,
  ): Promise<CourierRecord | null> {
    const row = await (await this.manager()).findOne(CourierEntity, {
      where: { id: courierId, tenantId, storeId },
    });
    return row === null ? null : toRecord(row);
  }

  async findByUserId(
    tenantId: string,
    userId: string,
  ): Promise<CourierRecord | null> {
    const row = await (await this.manager()).findOne(CourierEntity, {
      where: { tenantId, userId },
    });
    return row === null ? null : toRecord(row);
  }

  async lockInStore(
    tenantId: string,
    storeId: string,
    courierId: string,
    tx: TransactionContext,
  ): Promise<CourierRecord | null> {
    const row = await managerOf(tx)
      .createQueryBuilder(CourierEntity, 'courier')
      .setLock('pessimistic_write')
      .where('courier.id = :courierId', { courierId })
      .andWhere('courier.tenantId = :tenantId', { tenantId })
      .andWhere('courier.storeId = :storeId', { storeId })
      .getOne();
    return row === null ? null : toRecord(row);
  }

  async list(
    tenantId: string,
    storeId: string,
    query: CourierListQuery,
  ): Promise<{ items: CourierRecord[]; total: number }> {
    const manager = await this.manager();
    const qb = manager
      .createQueryBuilder(CourierEntity, 'courier')
      .where('courier.tenantId = :tenantId', { tenantId })
      .andWhere('courier.storeId = :storeId', { storeId });
    if (query.active !== null) {
      qb.andWhere('courier.active = :active', { active: query.active ? 1 : 0 });
    }
    if (query.status !== null) {
      qb.andWhere('courier.status = :status', { status: query.status });
    }
    const total = await qb.clone().getCount();
    const rows = await qb
      .orderBy('courier.name', 'ASC')
      .addOrderBy('courier.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();
    return { items: rows.map(toRecord), total };
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function toRecord(row: CourierEntity): CourierRecord {
  if (!isCourierStatus(row.status)) {
    throw new Error('The stored courier is invalid');
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    userId: row.userId,
    name: row.name,
    phone: row.phone,
    status: row.status,
    active: row.active,
    vehicleType: row.vehicleType,
    notes: row.notes,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function isMysqlDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return (candidate.code ?? candidate.driverError?.code) === 'ER_DUP_ENTRY';
}
