import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { EntityManager } from 'typeorm';
import { DomainEventDraft } from '../domain/domain-event';
import {
  OutboxEventRecord,
  OutboxFailureDecision,
  OutboxStore,
  ProcessedEventStore,
  isOutboxStatus,
} from '../domain/outbox';
import { OutboxEventEntity, ProcessedEventEntity } from './outbox.entities';

@Injectable()
export class TypeOrmOutbox implements OutboxStore {
  constructor(private readonly database: DatabaseReady) {}

  async insert(event: DomainEventDraft, tx: TransactionContext): Promise<void> {
    await managerOf(tx).insert(OutboxEventEntity, {
      id: event.id,
      tenantId: event.tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      type: event.type,
      payload: { ...event.payload },
      status: 'PENDING',
      attempts: 0,
      availableAt: event.availableAt,
      processedAt: null,
      lastError: null,
      lockedBy: null,
      createdAt: event.availableAt,
    });
  }

  async claimPending(
    lockedBy: string,
    limit: number,
    now: Date,
  ): Promise<string[]> {
    const manager = await this.manager();
    const batch = Math.min(Math.max(Math.trunc(limit), 1), 20);
    await manager.query(
      `UPDATE \`outbox_events\`
       SET \`status\` = 'PROCESSING', \`locked_by\` = ?
       WHERE \`status\` = 'PENDING' AND \`available_at\` <= ?
       ORDER BY \`available_at\` ASC, \`id\` ASC
       LIMIT ${batch}`,
      [lockedBy, now],
    );
    const rows: unknown = await manager.query(
      `SELECT \`id\`
       FROM \`outbox_events\`
       WHERE \`locked_by\` = ? AND \`status\` = 'PROCESSING'`,
      [lockedBy],
    );
    return readIds(rows);
  }

  async releaseClaim(id: string): Promise<void> {
    await (await this.manager()).update(
      OutboxEventEntity,
      { id, status: 'PROCESSING' },
      { status: 'PENDING', lockedBy: null },
    );
  }

  async findById(id: string): Promise<OutboxEventRecord | null> {
    const row = await (await this.manager()).findOne(OutboxEventEntity, {
      where: { id },
    });
    return row === null ? null : toRecord(row);
  }

  async markProcessed(id: string, processedAt: Date): Promise<void> {
    await (await this.manager()).update(
      OutboxEventEntity,
      { id, status: 'PROCESSING' },
      {
        status: 'PROCESSED',
        processedAt,
        lockedBy: null,
        lastError: null,
      },
    );
  }

  async applyFailure(
    id: string,
    expectedAttempts: number,
    lastError: string,
    decision: OutboxFailureDecision,
  ): Promise<void> {
    await (await this.manager()).update(
      OutboxEventEntity,
      { id, status: 'PROCESSING', attempts: expectedAttempts },
      {
        status: decision.status,
        attempts: decision.attempts,
        lastError,
        availableAt: decision.availableAt,
        lockedBy: null,
        processedAt: null,
      },
    );
  }

  async requeue(
    id: string,
    availableAt: Date,
  ): Promise<'requeued' | 'missing' | 'not_failed'> {
    const manager = await this.manager();
    const result = await manager.update(
      OutboxEventEntity,
      { id, status: 'FAILED' },
      {
        status: 'PENDING',
        attempts: 0,
        availableAt,
        processedAt: null,
        lastError: null,
        lockedBy: null,
      },
    );
    if (result.affected === 1) {
      return 'requeued';
    }
    const existing = await manager.findOne(OutboxEventEntity, { where: { id } });
    return existing === null ? 'missing' : 'not_failed';
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

@Injectable()
export class TypeOrmProcessedEvents implements ProcessedEventStore {
  constructor(private readonly database: DatabaseReady) {}

  async record(
    eventId: string,
    handler: string,
    processedAt: Date,
  ): Promise<boolean> {
    const dataSource = await this.database.ensure();
    try {
      await dataSource.manager.insert(ProcessedEventEntity, {
        eventId,
        handler,
        processedAt,
      });
      return true;
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        return false;
      }
      throw error;
    }
  }
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function toRecord(row: OutboxEventEntity): OutboxEventRecord {
  if (!isOutboxStatus(row.status)) {
    throw new Error('The stored outbox event is invalid');
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    type: row.type,
    payload: readPayload(row.payload),
    status: row.status,
    attempts: Number(row.attempts),
    availableAt: new Date(row.availableAt),
    processedAt: row.processedAt === null ? null : new Date(row.processedAt),
    lastError: row.lastError,
    lockedBy: row.lockedBy,
    createdAt: new Date(row.createdAt),
  };
}

function readPayload(value: unknown): Record<string, unknown> {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

function readIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null || !('id' in row)) {
      return [];
    }
    const id = (row as { id?: unknown }).id;
    return typeof id === 'string' ? [id] : [];
  });
}

function isMysqlDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return (
    candidate.code === 'ER_DUP_ENTRY' ||
    candidate.driverError?.code === 'ER_DUP_ENTRY'
  );
}
