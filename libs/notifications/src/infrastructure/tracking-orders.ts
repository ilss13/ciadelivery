import { createHash } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  TrackingOrderLookup,
  TrackingOrderScope,
} from '../domain/notification';

@Injectable()
export class TypeOrmTrackingOrders implements TrackingOrderLookup {
  constructor(private readonly database: DatabaseReady) {}

  async findByToken(trackingToken: string): Promise<TrackingOrderScope | null> {
    if (trackingToken.length === 0 || trackingToken.length > 256) {
      return null;
    }

    const hash = createHash('sha256').update(trackingToken).digest('hex');
    const dataSource = await this.database.ensure();
    const rows: unknown = await dataSource.query(
      `SELECT id, tenant_id, store_id FROM orders WHERE tracking_token_hash = ? LIMIT 1`,
      [hash],
    );
    const row = firstRow(rows);
    if (row === null) {
      return null;
    }
    return row;
  }
}

function firstRow(rows: unknown): TrackingOrderScope | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const row = rows[0];
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const orderId = record['id'];
  const tenantId = record['tenant_id'];
  const storeId = record['store_id'];
  if (
    typeof orderId !== 'string' ||
    typeof tenantId !== 'string' ||
    typeof storeId !== 'string'
  ) {
    return null;
  }
  return { orderId, tenantId, storeId };
}
