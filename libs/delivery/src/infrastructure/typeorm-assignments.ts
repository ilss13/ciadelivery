import { DomainException } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AssignmentRecord, AssignmentStatus } from '../domain/assignment';
import { Assignments, NewAssignment } from '../domain/assignments.port';
import { isCourierStatus } from '../domain/courier';
import { CourierEntity, DeliveryAssignmentEntity } from './courier.entities';

@Injectable()
export class TypeOrmAssignments implements Assignments {
  async insert(
    assignment: NewAssignment,
    tx: TransactionContext,
  ): Promise<void> {
    try {
      await managerOf(tx).insert(DeliveryAssignmentEntity, {
        ...assignment,
        outAt: null,
        deliveredAt: null,
      });
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw new DomainException(
          'ASSIGNMENT_EXISTS',
          'The order already has a courier assignment',
          409,
        );
      }
      throw error;
    }
  }

  async lockByOrder(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<AssignmentRecord | null> {
    const manager = managerOf(tx);
    const row = await manager
      .createQueryBuilder(DeliveryAssignmentEntity, 'assignment')
      .setLock('pessimistic_write')
      .where('assignment.orderId = :orderId', { orderId })
      .andWhere('assignment.tenantId = :tenantId', { tenantId })
      .getOne();
    if (row === null) {
      return null;
    }
    const courier = await manager.findOne(CourierEntity, {
      where: { id: row.courierId, tenantId },
    });
    if (courier === null || !isCourierStatus(courier.status)) {
      return null;
    }
    return toRecord(row, courier.userId);
  }

  async markOut(
    tenantId: string,
    orderId: string,
    at: Date,
    tx: TransactionContext,
  ): Promise<boolean> {
    const result = await managerOf(tx).update(
      DeliveryAssignmentEntity,
      { tenantId, orderId, status: 'ASSIGNED' },
      { status: 'OUT', outAt: at },
    );
    return result.affected === 1;
  }

  async markDelivered(
    tenantId: string,
    orderId: string,
    at: Date,
    tx: TransactionContext,
  ): Promise<boolean> {
    const result = await managerOf(tx).update(
      DeliveryAssignmentEntity,
      { tenantId, orderId, status: 'OUT' },
      { status: 'DELIVERED', deliveredAt: at },
    );
    return result.affected === 1;
  }
}

function toRecord(
  row: DeliveryAssignmentEntity,
  courierUserId: string,
): AssignmentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orderId: row.orderId,
    courierId: row.courierId,
    courierUserId,
    status: row.status as AssignmentStatus,
    assignedBy: row.assignedBy,
    assignedAt: new Date(row.assignedAt),
    outAt: row.outAt === null ? null : new Date(row.outAt),
    deliveredAt: row.deliveredAt === null ? null : new Date(row.deliveredAt),
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
