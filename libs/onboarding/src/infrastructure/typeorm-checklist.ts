import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Checklist,
  ChecklistMark,
  ChecklistStatusChange,
  StoredOnboardingStep,
  StorePublication,
} from '../domain/checklist';
import {
  ONBOARDING_CODES,
  OnboardingCode,
  OnboardingStatus,
  isOnboardingCode,
} from '../domain/steps';

interface StepRow {
  code: string;
  status: string;
  done_at: Date | string | null;
  done_by: string | null;
  note: string | null;
}

@Injectable()
export class TypeOrmChecklist implements Checklist {
  constructor(private readonly database: DatabaseReady) {}

  async seed(tenantId: string, tx: TransactionContext): Promise<void> {
    const manager = managerOf(tx);
    const now = new Date();
    for (const code of ONBOARDING_CODES) {
      const done = code === 'create_tenant' || code === 'create_store';
      await manager.query(
        `INSERT INTO \`onboarding_steps\` (
          \`id\`, \`tenant_id\`, \`code\`, \`status\`, \`done_at\`, \`done_by\`, \`note\`
        ) VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
        [randomUUID(), tenantId, code, done ? 'DONE' : 'PENDING', done ? now : null],
      );
    }
  }

  async markDone(mark: ChecklistMark, tx?: TransactionContext): Promise<void> {
    if (!isOnboardingCode(mark.code)) {
      return;
    }
    const now = new Date();
    await this.query(
      `UPDATE \`onboarding_steps\`
       SET \`status\` = 'DONE', \`done_at\` = ?, \`done_by\` = COALESCE(\`done_by\`, ?)
       WHERE \`tenant_id\` = ? AND \`code\` = ? AND \`status\` <> 'DONE'`,
      [now, mark.actorId, mark.tenantId, mark.code],
      tx,
    );
  }

  async list(
    tenantId: string,
    tx?: TransactionContext,
  ): Promise<StoredOnboardingStep[]> {
    const rows = await this.query<StepRow[]>(
      `SELECT \`code\`, \`status\`, \`done_at\`, \`done_by\`, \`note\`
       FROM \`onboarding_steps\`
       WHERE \`tenant_id\` = ?`,
      [tenantId],
      tx,
    );
    const byCode = new Map(rows.map((row) => [row.code, row]));
    return ONBOARDING_CODES.map((code) => toStep(code, byCode.get(code)));
  }

  async changeStatus(
    change: ChecklistStatusChange,
    tx?: TransactionContext,
  ): Promise<boolean> {
    const doneAt = change.status === 'PENDING' ? null : new Date();
    const doneBy = change.status === 'PENDING' ? null : change.actorId;
    const result = await this.query<unknown>(
      `UPDATE \`onboarding_steps\`
       SET \`status\` = ?, \`done_at\` = ?, \`done_by\` = ?, \`note\` = ?
       WHERE \`tenant_id\` = ? AND \`code\` = ?`,
      [
        change.status,
        doneAt,
        doneBy,
        change.note,
        change.tenantId,
        change.code,
      ],
      tx,
    );
    return affected(result) > 0;
  }

  async publication(
    tenantId: string,
    tx?: TransactionContext,
  ): Promise<StorePublication | null> {
    const rows = await this.query<{ id: string; published: number | boolean }[]>(
      `SELECT \`id\`, \`published\` FROM \`stores\` WHERE \`tenant_id\` = ? LIMIT 1`,
      [tenantId],
      tx,
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      storeId: row.id,
      published: row.published === true || row.published === 1,
    };
  }

  async setPublished(
    tenantId: string,
    storeId: string,
    published: boolean,
    tx: TransactionContext,
  ): Promise<void> {
    await managerOf(tx).query(
      `UPDATE \`stores\`
       SET \`published\` = ?, \`updated_at\` = ?
       WHERE \`tenant_id\` = ? AND \`id\` = ?`,
      [published ? 1 : 0, new Date(), tenantId, storeId],
    );
  }

  async countActiveProducts(
    tenantId: string,
    storeId: string,
    tx?: TransactionContext,
  ): Promise<number> {
    const rows = await this.query<{ total: number | string }[]>(
      `SELECT COUNT(*) AS \`total\`
       FROM \`products\`
       WHERE \`tenant_id\` = ? AND \`store_id\` = ? AND \`active\` = 1`,
      [tenantId, storeId],
      tx,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async query<T>(
    sql: string,
    params: unknown[],
    tx?: TransactionContext,
  ): Promise<T> {
    const manager =
      tx === undefined
        ? (await this.database.ensure()).manager
        : managerOf(tx);
    return manager.query(sql, params) as Promise<T>;
  }
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function toStep(code: OnboardingCode, row: StepRow | undefined): StoredOnboardingStep {
  if (row === undefined || !isStatus(row.status)) {
    return {
      code,
      status: 'PENDING',
      doneAt: null,
      doneBy: null,
      note: null,
    };
  }
  return {
    code,
    status: row.status,
    doneAt: row.done_at === null ? null : new Date(row.done_at),
    doneBy: row.done_by,
    note: row.note,
  };
}

function isStatus(value: string): value is OnboardingStatus {
  return value === 'PENDING' || value === 'DONE' || value === 'SKIPPED';
}

function affected(result: unknown): number {
  if (typeof result !== 'object' || result === null || !('affectedRows' in result)) {
    return 0;
  }
  const rows = result.affectedRows;
  return typeof rows === 'number' ? rows : 0;
}
