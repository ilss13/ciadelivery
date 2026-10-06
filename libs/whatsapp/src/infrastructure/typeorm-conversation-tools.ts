import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { completeWeek, isStoreOpen } from '@ciadelivery/branding';
import {
  CartProductSnapshot,
  CartRequestItem,
  validateCart,
} from '@ciadelivery/catalog';
import {
  DeliveryPolicySnapshot,
  quoteFulfillment,
} from '@ciadelivery/delivery';
import {
  AddressInput,
  DatabaseReady,
  DomainException,
  GeocodingProvider,
} from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import {
  ConversationToolCall,
  ConversationToolContext,
  ConversationTools,
  PreviewToolResult,
  isAddressInput,
  isRecord,
} from '../domain/conversation-tools';

interface StoreRow {
  id: string;
  tenantId: string;
  minimumOrderCents: number | string;
  isManuallyClosed: number | boolean;
  timezone: string;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number | string;
  active: number | boolean;
  available: number | boolean;
}

interface GroupRow {
  id: string;
  productId: string;
  name: string;
  minSelect: number | string;
  maxSelect: number | string;
}

interface OptionRow {
  id: string;
  groupId: string;
  name: string;
  priceCents: number | string;
  available: number | boolean;
}

type PreviewItemInput = CartRequestItem;

@Injectable()
export class TypeOrmConversationTools implements ConversationTools {
  constructor(
    private readonly database: DatabaseReady,
    private readonly geocoding: GeocodingProvider,
  ) {}

  async execute(
    context: ConversationToolContext,
    call: ConversationToolCall,
  ): Promise<unknown> {
    try {
      switch (call.name) {
        case 'search_catalog':
          return await this.searchCatalog(context, call.arguments);
        case 'get_product':
          return await this.getProduct(context, call.arguments);
        case 'resolve_options':
          return await this.resolveOptions(context, call.arguments);
        case 'quote_delivery':
          return await this.quoteDelivery(context, call.arguments);
        case 'preview_order':
          return await this.previewOrder(context, call.arguments);
        default:
          return failure('UNKNOWN_TOOL');
      }
    } catch (error) {
      if (error instanceof DomainException) {
        return failure(error.code, error.details);
      }
      throw error;
    }
  }

  private async searchCatalog(
    context: ConversationToolContext,
    value: unknown,
  ): Promise<unknown> {
    const query = textArgument(value, 'query', 80);
    if (query === null) {
      return failure('INVALID_ARGUMENTS');
    }
    const source = await this.database.ensure();
    const rows: ProductRow[] = await source.query(
      `SELECT p.id, p.name, p.price_cents AS priceCents,
              p.sku, p.active, p.available
         FROM products p
         JOIN categories c
           ON c.id = p.category_id
          AND c.tenant_id = p.tenant_id
          AND c.store_id = p.store_id
        WHERE p.tenant_id = ? AND p.store_id = ?
          AND p.active = 1 AND c.active = 1
          AND p.name LIKE ? ESCAPE '\\\\'
        ORDER BY p.sort_order ASC, p.name ASC
        LIMIT 8`,
      [context.tenantId, context.storeId, `%${escapeLike(query)}%`],
    );
    const groups = await this.groups(context, rows.map((row) => row.id));
    return {
      ok: true,
      products: rows.map((row) => ({
        id: row.id,
        name: row.name,
        priceCents: Number(row.priceCents),
        available: flag(row.available),
        requiredGroups: groups
          .filter(
            (group) =>
              group.productId === row.id && Number(group.minSelect) > 0,
          )
          .map((group) => ({
            id: group.id,
            name: group.name,
            minSelect: Number(group.minSelect),
            maxSelect: Number(group.maxSelect),
          })),
      })),
    };
  }

  private async getProduct(
    context: ConversationToolContext,
    value: unknown,
  ): Promise<unknown> {
    const productId = idArgument(value, 'productId');
    if (productId === null) {
      return failure('INVALID_ARGUMENTS');
    }
    const snapshots = await this.products(context, [productId]);
    const product = snapshots[0];
    if (product === undefined || !product.active) {
      return failure('NOT_FOUND');
    }
    return {
      ok: true,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        priceCents: product.priceCents,
        available: product.available,
        optionGroups: product.groups.map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: group.options
            .filter((option) => option.available)
            .map((option) => ({
              id: option.id,
              name: option.name,
              priceCents: option.priceCents,
            })),
        })),
      },
    };
  }

  private async resolveOptions(
    context: ConversationToolContext,
    value: unknown,
  ): Promise<unknown> {
    if (!isRecord(value)) {
      return failure('INVALID_ARGUMENTS');
    }
    const productId = id(value['productId']);
    const optionIds = ids(value['optionIds']);
    if (productId === null || optionIds === null) {
      return failure('INVALID_ARGUMENTS');
    }
    const products = await this.products(context, [productId]);
    if (products.length === 0 || !products[0]?.active) {
      return failure('NOT_FOUND');
    }
    const cart = validateCart({
      items: [{ productId, quantity: 1, optionIds, notes: null }],
      products,
      minimumOrderCents: 0,
      storeOpen: true,
    });
    if (!cart.valid) {
      return failure(cart.errors[0]?.code ?? 'OPTION_SELECTION_INVALID', cart.errors);
    }
    return {
      ok: true,
      options: cart.items[0]?.options ?? [],
      itemSubtotalCents: cart.items[0]?.subtotalCents ?? 0,
    };
  }

  private async quoteDelivery(
    context: ConversationToolContext,
    value: unknown,
  ): Promise<unknown> {
    if (!isRecord(value) || !isAddressInput(value['address'])) {
      return failure('INVALID_ARGUMENTS');
    }
    return {
      ok: true,
      ...(await this.quote(context, 'DELIVERY', value['address'])),
    };
  }

  private async previewOrder(
    context: ConversationToolContext,
    value: unknown,
  ): Promise<unknown> {
    const parsed = previewArguments(value);
    if (parsed === null) {
      return failure('INVALID_ARGUMENTS');
    }
    const store = await this.store(context);
    if (store === null) {
      return failure('NOT_FOUND');
    }
    const products = await this.products(
      context,
      [...new Set(parsed.items.map((item) => item.productId))],
    );
    const cart = validateCart({
      items: parsed.items,
      products,
      minimumOrderCents: Number(store.minimumOrderCents),
      storeOpen: await this.open(context, store),
    });
    if (!cart.valid) {
      return failure(cart.errors[0]?.code ?? 'CART_INVALID', cart.errors);
    }
    const quote = await this.quote(
      context,
      parsed.fulfillment,
      parsed.address,
    );
    if (!quote.accepted) {
      return failure(quote.reason ?? 'DELIVERY_UNAVAILABLE', quote);
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60_000);
    const result: PreviewToolResult = {
      previewToken: token,
      customerName: parsed.name,
      items: cart.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        options: item.options.map((option) => option.name),
      })),
      subtotalCents: cart.subtotalCents,
      deliveryFeeCents: quote.feeCents,
      totalCents: cart.subtotalCents + quote.feeCents,
    };
    const payload = {
      customer: { name: parsed.name, phone: context.contactPhone },
      fulfillment: parsed.fulfillment,
      address: parsed.fulfillment === 'DELIVERY' ? parsed.address : null,
      items: cart.items.map((item) => ({
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        options: item.options,
        notes: item.notes,
        subtotalCents: item.subtotalCents,
      })),
      subtotalCents: result.subtotalCents,
      deliveryFeeCents: result.deliveryFeeCents,
      totalCents: result.totalCents,
      quote,
    };
    const source = await this.database.ensure();
    await source.transaction(async (manager) => {
      await manager.query(
        `UPDATE order_previews
            SET invalidated_at = ?
          WHERE tenant_id = ? AND conversation_id = ? AND invalidated_at IS NULL`,
        [now, context.tenantId, context.conversationId],
      );
      await manager.query(
        `INSERT INTO order_previews (
           id, tenant_id, store_id, conversation_id, token_hash, payload,
           expires_at, invalidated_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          randomUUID(),
          context.tenantId,
          context.storeId,
          context.conversationId,
          hashToken(token),
          JSON.stringify(payload),
          expiresAt,
          now,
        ],
      );
    });
    return { ok: true, ...result };
  }

  private async store(
    context: ConversationToolContext,
  ): Promise<StoreRow | null> {
    const source = await this.database.ensure();
    const rows: StoreRow[] = await source.query(
      `SELECT id, tenant_id AS tenantId,
              minimum_order_cents AS minimumOrderCents,
              is_manually_closed AS isManuallyClosed, timezone
         FROM stores
        WHERE tenant_id = ? AND id = ?
        LIMIT 1`,
      [context.tenantId, context.storeId],
    );
    return rows[0] ?? null;
  }

  private async open(
    context: ConversationToolContext,
    store: StoreRow,
  ): Promise<boolean> {
    const source = await this.database.ensure();
    const rows: Array<{
      weekday: number | string;
      opensAt: string;
      closesAt: string;
      closed: number | boolean;
    }> = await source.query(
      `SELECT weekday, opens_at AS opensAt, closes_at AS closesAt, closed
         FROM business_hours
        WHERE tenant_id = ? AND store_id = ?`,
      [context.tenantId, context.storeId],
    );
    return isStoreOpen({
      now: new Date(),
      timeZone: store.timezone,
      manuallyClosed: flag(store.isManuallyClosed),
      hours: completeWeek(
        rows.map((row) => ({
          weekday: Number(row.weekday),
          opensAt: sqlTime(row.opensAt),
          closesAt: sqlTime(row.closesAt),
          closed: flag(row.closed),
        })),
      ),
    });
  }

  private async products(
    context: ConversationToolContext,
    productIds: readonly string[],
  ): Promise<CartProductSnapshot[]> {
    if (productIds.length === 0) {
      return [];
    }
    const source = await this.database.ensure();
    const marks = productIds.map(() => '?').join(', ');
    const products: ProductRow[] = await source.query(
      `SELECT p.id, p.name, p.sku, p.price_cents AS priceCents,
              p.active, p.available
         FROM products p
         JOIN categories c
           ON c.id = p.category_id
          AND c.tenant_id = p.tenant_id
          AND c.store_id = p.store_id
        WHERE p.tenant_id = ? AND p.store_id = ?
          AND c.active = 1 AND p.id IN (${marks})`,
      [context.tenantId, context.storeId, ...productIds],
    );
    const groups = await this.groups(context, products.map((row) => row.id));
    const options = await this.options(context, groups.map((row) => row.id));
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      priceCents: Number(product.priceCents),
      active: flag(product.active),
      available: flag(product.available),
      groups: groups
        .filter((group) => group.productId === product.id)
        .map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: Number(group.minSelect),
          maxSelect: Number(group.maxSelect),
          options: options
            .filter((option) => option.groupId === group.id)
            .map((option) => ({
              id: option.id,
              groupId: option.groupId,
              name: option.name,
              priceCents: Number(option.priceCents),
              available: flag(option.available),
            })),
        })),
    }));
  }

  private async groups(
    context: ConversationToolContext,
    productIds: readonly string[],
  ): Promise<GroupRow[]> {
    if (productIds.length === 0) {
      return [];
    }
    const source = await this.database.ensure();
    const marks = productIds.map(() => '?').join(', ');
    return source.query(
      `SELECT id, product_id AS productId, name,
              min_select AS minSelect, max_select AS maxSelect
         FROM product_option_groups
        WHERE tenant_id = ? AND store_id = ? AND product_id IN (${marks})
        ORDER BY sort_order ASC, name ASC`,
      [context.tenantId, context.storeId, ...productIds],
    );
  }

  private async options(
    context: ConversationToolContext,
    groupIds: readonly string[],
  ): Promise<OptionRow[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const source = await this.database.ensure();
    const marks = groupIds.map(() => '?').join(', ');
    return source.query(
      `SELECT id, group_id AS groupId, name,
              price_cents AS priceCents, available
         FROM product_options
        WHERE tenant_id = ? AND store_id = ? AND group_id IN (${marks})
        ORDER BY sort_order ASC, name ASC`,
      [context.tenantId, context.storeId, ...groupIds],
    );
  }

  private async quote(
    context: ConversationToolContext,
    fulfillment: 'DELIVERY' | 'PICKUP',
    address: AddressInput | null,
  ) {
    const policy = await this.policy(context);
    const quote = await quoteFulfillment(this.geocoding, {
      fulfillment,
      policy,
      address: fulfillment === 'PICKUP' ? null : address,
    });
    return {
      accepted: quote.accepted,
      fulfillment: quote.fulfillment,
      distanceKm: quote.distanceKm,
      feeCents: quote.feeCents,
      estimatedMinutes: quote.estimatedMinutes,
      reason: quote.reason,
    };
  }

  private async policy(
    context: ConversationToolContext,
  ): Promise<DeliveryPolicySnapshot | null> {
    const source = await this.database.ensure();
    const configs: Array<Record<string, unknown>> = await source.query(
      `SELECT id, tenant_id AS tenantId, store_id AS storeId,
              delivery_enabled AS deliveryEnabled,
              pickup_enabled AS pickupEnabled,
              max_radius_km AS maxRadiusKm, fee_mode AS feeMode,
              flat_fee_cents AS flatFeeCents,
              estimated_minutes AS estimatedMinutes,
              origin_latitude AS originLatitude,
              origin_longitude AS originLongitude,
              created_at AS createdAt, updated_at AS updatedAt
         FROM delivery_configs
        WHERE tenant_id = ? AND store_id = ?
        LIMIT 1`,
      [context.tenantId, context.storeId],
    );
    const config = configs[0];
    if (config === undefined) {
      return null;
    }
    const zones: Array<Record<string, unknown>> = await source.query(
      `SELECT id, tenant_id AS tenantId, store_id AS storeId,
              from_km AS fromKm, to_km AS toKm,
              fee_cents AS feeCents, sort_order AS sortOrder
         FROM delivery_zones
        WHERE tenant_id = ? AND store_id = ?
        ORDER BY sort_order ASC`,
      [context.tenantId, context.storeId],
    );
    return {
      config: {
        id: String(config['id']),
        tenantId: String(config['tenantId']),
        storeId: String(config['storeId']),
        deliveryEnabled: flag(config['deliveryEnabled']),
        pickupEnabled: flag(config['pickupEnabled']),
        maxRadiusKm: Number(config['maxRadiusKm']),
        feeMode: config['feeMode'] === 'ZONE' ? 'ZONE' : 'FLAT',
        flatFeeCents: Number(config['flatFeeCents']),
        estimatedMinutes: Number(config['estimatedMinutes']),
        originLatitude: nullableNumber(config['originLatitude']),
        originLongitude: nullableNumber(config['originLongitude']),
        createdAt: new Date(String(config['createdAt'])),
        updatedAt: new Date(String(config['updatedAt'])),
      },
      zones: zones.map((zone) => ({
        id: String(zone['id']),
        tenantId: String(zone['tenantId']),
        storeId: String(zone['storeId']),
        fromKm: Number(zone['fromKm']),
        toKm: Number(zone['toKm']),
        feeCents: Number(zone['feeCents']),
        sortOrder: Number(zone['sortOrder']),
      })),
    };
  }
}

function previewArguments(value: unknown): {
  items: PreviewItemInput[];
  fulfillment: 'DELIVERY' | 'PICKUP';
  address: AddressInput | null;
  name: string;
} | null {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    return null;
  }
  const fulfillment = value['fulfillment'];
  const name =
    typeof value['name'] === 'string' ? value['name'].trim().slice(0, 160) : '';
  const phone =
    typeof value['phone'] === 'string' ? value['phone'].replace(/\D/g, '') : '';
  if (
    (fulfillment !== 'DELIVERY' && fulfillment !== 'PICKUP') ||
    name.length === 0 ||
    phone.length < 8 ||
    value['items'].length === 0 ||
    value['items'].length > 50
  ) {
    return null;
  }
  const address =
    fulfillment === 'DELIVERY' && isAddressInput(value['address'])
      ? value['address']
      : null;
  if (fulfillment === 'DELIVERY' && address === null) {
    return null;
  }
  const items: PreviewItemInput[] = [];
  for (const raw of value['items']) {
    if (!isRecord(raw)) {
      return null;
    }
    const productId = id(raw['productId']);
    const optionIds = ids(raw['optionIds']);
    const quantity = raw['quantity'];
    const notes = raw['notes'];
    if (
      productId === null ||
      optionIds === null ||
      !Number.isInteger(quantity) ||
      Number(quantity) < 1 ||
      Number(quantity) > 99 ||
      (notes !== undefined && notes !== null && typeof notes !== 'string')
    ) {
      return null;
    }
    items.push({
      productId,
      optionIds,
      quantity: Number(quantity),
      notes: typeof notes === 'string' ? notes.slice(0, 281) : null,
    });
  }
  return { items, fulfillment, address, name };
}

function failure(code: string, details: unknown = null): object {
  return { ok: false, error: { code, details } };
}

function textArgument(
  value: unknown,
  key: string,
  maxLength: number,
): string | null {
  if (!isRecord(value) || typeof value[key] !== 'string') {
    return null;
  }
  const text = value[key].trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function idArgument(value: unknown, key: string): string | null {
  return isRecord(value) ? id(value[key]) : null;
}

function id(value: unknown): string | null {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
    ? value
    : null;
}

function ids(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 50) {
    return null;
  }
  const values = value.map(id);
  return values.every((item): item is string => item !== null) ? values : null;
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sqlTime(value: string): string {
  const match = /^(\d{2}:\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value;
}
