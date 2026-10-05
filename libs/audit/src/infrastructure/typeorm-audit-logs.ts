import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ActorType,
  AuditDraft,
  AuditListQuery,
  AuditLogView,
  AuditLogs,
  AuditPage,
} from '../domain/audit-log';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class TypeOrmAuditLogs implements AuditLogs {
  constructor(private readonly database: DatabaseReady) {}

  async record(draft: AuditDraft, tx: TransactionContext): Promise<void> {
    const manager = tx as unknown as EntityManager;
    await manager.insert(AuditLogEntity, {
      id: randomUUID(),
      tenantId: draft.tenantId,
      actorId: draft.actorId,
      actorType: draft.actorType,
      action: clip(draft.action, 64),
      entityType: clip(draft.entityType, 64),
      entityId: clip(draft.entityId, 64),
      before: draft.before as never,
      changes: draft.changes as never,
      ip: draft.ip === null ? null : clip(draft.ip, 64),
      userAgent: draft.userAgent === null ? null : clip(draft.userAgent, 512),
      createdAt: new Date(),
    });
  }

  async list(query: AuditListQuery): Promise<AuditPage> {
    const dataSource = await this.database.ensure();
    const builder = dataSource
      .getRepository(AuditLogEntity)
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId: query.tenantId });
    if (query.action !== undefined) {
      builder.andWhere('log.action = :action', { action: query.action });
    }
    if (query.entityType !== undefined) {
      builder.andWhere('log.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.from !== undefined) {
      builder.andWhere('log.createdAt >= :from', { from: query.from });
    }
    if (query.to !== undefined) {
      builder.andWhere('log.createdAt <= :to', { to: query.to });
    }
    const total = await builder.getCount();
    const rows = await builder
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();
    return {
      data: rows.map(toView),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }
}

function toView(row: AuditLogEntity): AuditLogView {
  return {
    id: row.id,
    actorId: row.actorId,
    actorType: row.actorType as ActorType,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: asRecord(row.before),
    changes: asRecord(row.changes),
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, unknown>;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}
