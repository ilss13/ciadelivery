import { CreatePublicOrder } from '@ciadelivery/orders';
import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore } from '@ciadelivery/stores';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConversationOrderInput,
  ConversationOrderResult,
  ConversationOrders,
} from '../domain/conversation-orders.port';
import {
  PreviewToolResult,
  isRecord,
} from '../domain/conversation-tools';
import { TypeOrmConversationTools } from './typeorm-conversation-tools';

const POLICY_VERSION = '2026-10-02';

interface PreviewRow {
  id: string;
  payload: unknown;
  expiresAt: Date | string;
}

interface PreviewPayload {
  customer: { name: string };
  fulfillment: 'DELIVERY' | 'PICKUP';
  address: Record<string, unknown> | null;
  items: Array<{
    productId: string;
    quantity: number;
    notes: string | null;
    options: Array<{ id: string }>;
  }>;
  totalCents: number;
}

@Injectable()
export class TypeOrmConversationOrders implements ConversationOrders {
  constructor(
    private readonly database: DatabaseReady,
    @Inject(CURRENT_STORE)
    private readonly stores: CurrentStore,
    private readonly tools: TypeOrmConversationTools,
    private readonly createOrder: CreatePublicOrder,
  ) {}

  async confirm(
    input: ConversationOrderInput,
  ): Promise<ConversationOrderResult> {
    const row = await this.latest(input);
    if (row === null) {
      return { outcome: 'MISSING' };
    }
    const now = new Date();
    if (new Date(row.expiresAt).getTime() <= now.getTime()) {
      await this.invalidate(input, row.id, now);
      return {
        outcome: 'EXPIRED',
        repeated: (await this.expiredCount(input, now)) >= 2,
      };
    }
    const payload = previewPayload(row.payload);
    if (payload === null) {
      return { outcome: 'TOOL_FAILED' };
    }
    const customerName =
      payload.customer.name.trim() ||
      input.contactName?.trim() ||
      'Cliente WhatsApp';
    const refreshed = await this.tools.execute(
      {
        tenantId: input.tenantId,
        storeId: input.storeId,
        conversationId: input.conversationId,
        contactPhone: input.contactPhone,
      },
      {
        id: 'confirm-preview',
        name: 'preview_order',
        arguments: {
          items: payload.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            optionIds: item.options.map((option) => option.id),
            notes: item.notes,
          })),
          fulfillment: payload.fulfillment,
          address: payload.address,
          phone: input.contactPhone,
          name: customerName,
        },
      },
    );
    if (!isPreview(refreshed)) {
      return { outcome: 'TOOL_FAILED' };
    }
    if (refreshed.totalCents !== payload.totalCents) {
      return { outcome: 'PRICE_CHANGED', preview: refreshed };
    }
    const store = await this.stores.findByScope(input.tenantId, input.storeId);
    if (store === null) {
      return { outcome: 'TOOL_FAILED' };
    }
    try {
      const created = await this.createOrder.executeForStore(
        {
          customer: { name: customerName, phone: input.contactPhone },
          fulfillment: payload.fulfillment,
          address: payload.address as never,
          paymentMethodCode: 'CASH',
          notes: null,
          consents: {
            operational: true,
            marketing: false,
            policyVersion: POLICY_VERSION,
          },
          items: payload.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            optionIds: item.options.map((option) => option.id),
            notes: item.notes,
          })),
        },
        {
          idempotencyKey: row.id,
          ip: `whatsapp:${input.contactPhone}`,
          userAgent: 'ciadelivery-whatsapp-bot',
        },
        store,
        { source: 'WHATSAPP', expectedTotalCents: payload.totalCents },
      );
      const source = await this.database.ensure();
      await source.transaction(async (manager) => {
        await manager.query(
          `UPDATE conversations
              SET linked_order_id = ?, mode = 'HUMAN', updated_at = ?
            WHERE id = ? AND tenant_id = ? AND store_id = ?`,
          [
            created.orderId,
            now,
            input.conversationId,
            input.tenantId,
            input.storeId,
          ],
        );
        await manager.query(
          `UPDATE order_previews
              SET invalidated_at = COALESCE(invalidated_at, ?)
            WHERE tenant_id = ? AND conversation_id = ?`,
          [now, input.tenantId, input.conversationId],
        );
      });
      return {
        outcome: 'CREATED',
        orderId: created.orderId,
        orderNumber: created.orderNumber,
        trackingPath: created.trackingPath,
        customerName,
      };
    } catch (error) {
      if (
        error instanceof DomainException &&
        error.code === 'PAYMENT_METHOD_DISABLED'
      ) {
        return { outcome: 'PAYMENT_REQUIRED' };
      }
      if (
        error instanceof DomainException &&
        error.code === 'ORDER_TOTAL_CHANGED'
      ) {
        return { outcome: 'PRICE_CHANGED', preview: refreshed };
      }
      throw error;
    }
  }

  async cancel(input: ConversationOrderInput): Promise<boolean> {
    const source = await this.database.ensure();
    const now = new Date();
    const result = await source.query(
      `UPDATE order_previews
          SET invalidated_at = ?
        WHERE tenant_id = ? AND store_id = ? AND conversation_id = ?
          AND invalidated_at IS NULL`,
      [now, input.tenantId, input.storeId, input.conversationId],
    );
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  }

  private async latest(
    input: ConversationOrderInput,
  ): Promise<PreviewRow | null> {
    const source = await this.database.ensure();
    const rows: PreviewRow[] = await source.query(
      `SELECT id, payload, expires_at AS expiresAt
         FROM order_previews
        WHERE tenant_id = ? AND store_id = ? AND conversation_id = ?
          AND invalidated_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [input.tenantId, input.storeId, input.conversationId],
    );
    return rows[0] ?? null;
  }

  private async invalidate(
    input: ConversationOrderInput,
    id: string,
    at: Date,
  ): Promise<void> {
    const source = await this.database.ensure();
    await source.query(
      `UPDATE order_previews SET invalidated_at = ?
        WHERE id = ? AND tenant_id = ? AND store_id = ? AND conversation_id = ?`,
      [at, id, input.tenantId, input.storeId, input.conversationId],
    );
  }

  private async expiredCount(
    input: ConversationOrderInput,
    at: Date,
  ): Promise<number> {
    const source = await this.database.ensure();
    const rows: Array<{ total: number | string }> = await source.query(
      `SELECT COUNT(*) AS total
         FROM order_previews
        WHERE tenant_id = ? AND store_id = ? AND conversation_id = ?
          AND expires_at <= ?`,
      [input.tenantId, input.storeId, input.conversationId, at],
    );
    return Number(rows[0]?.total ?? 0);
  }
}

function previewPayload(value: unknown): PreviewPayload | null {
  const parsed = parseJson(value);
  if (
    !isRecord(parsed) ||
    !isRecord(parsed['customer']) ||
    typeof parsed['customer']['name'] !== 'string' ||
    (parsed['fulfillment'] !== 'DELIVERY' &&
      parsed['fulfillment'] !== 'PICKUP') ||
    !Array.isArray(parsed['items']) ||
    typeof parsed['totalCents'] !== 'number'
  ) {
    return null;
  }
  const items: PreviewPayload['items'] = [];
  for (const value of parsed['items']) {
    if (
      !isRecord(value) ||
      typeof value['productId'] !== 'string' ||
      !Number.isInteger(value['quantity']) ||
      !Array.isArray(value['options'])
    ) {
      return null;
    }
    const options = value['options'].map((option) =>
      isRecord(option) && typeof option['id'] === 'string'
        ? { id: option['id'] }
        : null,
    );
    if (options.some((option) => option === null)) {
      return null;
    }
    items.push({
      productId: value['productId'],
      quantity: Number(value['quantity']),
      notes: typeof value['notes'] === 'string' ? value['notes'] : null,
      options: options as Array<{ id: string }>,
    });
  }
  return {
    customer: { name: parsed['customer']['name'] },
    fulfillment: parsed['fulfillment'],
    address: isRecord(parsed['address']) ? parsed['address'] : null,
    items,
    totalCents: parsed['totalCents'],
  };
}

function isPreview(value: unknown): value is PreviewToolResult {
  return (
    isRecord(value) &&
    value['ok'] === true &&
    typeof value['previewToken'] === 'string' &&
    typeof value['customerName'] === 'string' &&
    Array.isArray(value['items']) &&
    typeof value['subtotalCents'] === 'number' &&
    typeof value['deliveryFeeCents'] === 'number' &&
    typeof value['totalCents'] === 'number'
  );
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
