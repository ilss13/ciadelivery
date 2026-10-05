import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { ConversationRoomAccess } from '../domain/realtime';

@Injectable()
export class TypeOrmConversationRooms implements ConversationRoomAccess {
  constructor(private readonly database: DatabaseReady) {}

  async belongsToStore(
    conversationId: string,
    tenantId: string,
    storeId: string,
  ): Promise<boolean> {
    const source = await this.database.ensure();
    const rows: Array<{ id: string }> = await source.query(
      `SELECT id
         FROM conversations
        WHERE id = ? AND tenant_id = ? AND store_id = ?
        LIMIT 1`,
      [conversationId, tenantId, storeId],
    );
    return rows.length > 0;
  }
}
