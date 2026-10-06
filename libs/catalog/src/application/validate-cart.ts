import {
  BusinessHourEntity,
  completeWeek,
  isStoreOpen,
} from '@ciadelivery/branding';
import { DatabaseReady } from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import {
  CartProductSnapshot,
  CartRequestItem,
  CartValidation,
  validateCart,
} from '../domain/cart';
import { CatalogRepository } from '../domain/catalog-repository';
import { CatalogScope, ProductRecord } from '../domain/catalog';
import { requirePublicStore } from './actor-store';

export class ValidatePublicCart {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly stores: CurrentStore,
    private readonly database: DatabaseReady,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(items: readonly CartRequestItem[]): Promise<CartValidation> {
    const store = await requirePublicStore(this.stores);
    return this.executeForStore(store, items);
  }

  async executeForStore(
    store: StoreRecord,
    items: readonly CartRequestItem[],
  ): Promise<CartValidation> {
    const scope = { tenantId: store.tenantId, storeId: store.id };
    const dataSource = await this.database.ensure();
    const rows = await dataSource.manager.find(BusinessHourEntity, {
      where: { tenantId: store.tenantId, storeId: store.id },
      order: { weekday: 'ASC' },
    });
    return validateCart({
      items,
      products: await this.snapshots(scope, items),
      minimumOrderCents: store.minimumOrderCents,
      storeOpen: isStoreOpen({
        now: this.now(),
        timeZone: store.timezone,
        manuallyClosed: store.isManuallyClosed,
        hours: completeWeek(
          rows.map((row) => ({
            weekday: Number(row.weekday),
            opensAt: row.opensAt,
            closesAt: row.closesAt,
            closed: row.closed,
          })),
        ),
      }),
    });
  }

  private async snapshots(
    scope: CatalogScope,
    items: readonly CartRequestItem[],
  ): Promise<CartProductSnapshot[]> {
    const ids = [...new Set(items.map((item) => item.productId))];
    const products: ProductRecord[] = [];
    for (const id of ids) {
      const product = await this.catalog.findProduct(scope, id);
      if (product !== null) {
        products.push(product);
      }
    }
    const groups = await this.catalog.listGroupsForProducts(
      scope,
      products.map((product) => product.id),
    );
    const options = await this.catalog.listOptionsForGroups(
      scope,
      groups.map((group) => group.id),
    );
    return products.map((product) => ({
      id: product.id,
      active: product.active,
      available: product.available,
      name: product.name,
      sku: product.sku,
      priceCents: product.priceCents,
      groups: groups
        .filter((group) => group.productId === product.id)
        .map((group) => ({
          id: group.id,
          name: group.name,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          options: options
            .filter((option) => option.groupId === group.id)
            .map((option) => ({
              id: option.id,
              groupId: group.id,
              name: option.name,
              priceCents: option.priceCents,
              available: option.available,
            })),
        })),
    }));
  }
}
