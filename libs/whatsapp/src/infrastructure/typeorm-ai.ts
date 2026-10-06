import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  AiConfigurations,
  AiStoreSettings,
  AiTurnRecord,
  AiTurns,
} from '../domain/ai-turns.port';

@Injectable()
export class TypeOrmAiConfigurations implements AiConfigurations {
  constructor(private readonly database: DatabaseReady) {}

  async find(
    tenantId: string,
    storeId: string,
  ): Promise<AiStoreSettings | null> {
    const source = await this.database.ensure();
    const rows: Array<{ ai_enabled: number; ai_auto_reply: number }> =
      await source.query(
        `SELECT ai_enabled, ai_auto_reply
           FROM stores
          WHERE tenant_id = ? AND id = ?
          LIMIT 1`,
        [tenantId, storeId],
      );
    const row = rows[0];
    return row === undefined
      ? null
      : {
          aiEnabled: row.ai_enabled === 1,
          aiAutoReply: row.ai_auto_reply === 1,
        };
  }

  async update(
    tenantId: string,
    storeId: string,
    settings: AiStoreSettings,
  ): Promise<AiStoreSettings | null> {
    const source = await this.database.ensure();
    const result = await source.query(
      `UPDATE stores
          SET ai_enabled = ?, ai_auto_reply = ?, updated_at = ?
        WHERE tenant_id = ? AND id = ?`,
      [
        settings.aiEnabled ? 1 : 0,
        settings.aiAutoReply ? 1 : 0,
        new Date(),
        tenantId,
        storeId,
      ],
    );
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) === 1
      ? settings
      : null;
  }
}

@Injectable()
export class TypeOrmAiTurns implements AiTurns {
  constructor(private readonly database: DatabaseReady) {}

  async countSince(
    tenantId: string,
    conversationId: string,
    since: Date,
  ): Promise<number> {
    const source = await this.database.ensure();
    const rows: Array<{ total: number | string }> = await source.query(
      `SELECT COUNT(*) AS total
         FROM ai_turns
        WHERE tenant_id = ? AND conversation_id = ? AND created_at >= ?`,
      [tenantId, conversationId, since],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async record(turn: AiTurnRecord): Promise<void> {
    const source = await this.database.ensure();
    await source.query(
      `INSERT INTO ai_turns (
         id, tenant_id, conversation_id, confidence, outcome, prompt_hash, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        turn.id,
        turn.tenantId,
        turn.conversationId,
        turn.confidence,
        turn.outcome,
        turn.promptHash,
        turn.createdAt,
      ],
    );
  }
}
