import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { CartProductSnapshot } from '../domain/cart';
import { CatalogRepository } from '../domain/catalog-repository';
import { requireActorStore } from './actor-store';

export class TestOrderCatalog {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly stores: CurrentStore,
  ) {}

  async firstActiveProduct(actor: RequestActor): Promise<CartProductSnapshot | null> {
    const store = await requireActorStore(actor, this.stores);
    const scope = { tenantId: store.tenantId, storeId: store.id };
    const listed = await this.catalog.listPublicProducts(
      scope,
      { page: 1, pageSize: 1 },
      undefined,
    );
    const product = listed.data[0];
    if (product === undefined || !product.available) {
      return null;
    }
    const groups = await this.catalog.listGroups(scope, product.id);
    const options = await this.catalog.listOptionsForGroups(
      scope,
      groups.map((group) => group.id),
    );
    return {
      id: product.id,
      active: product.active,
      available: product.available,
      name: product.name,
      sku: product.sku,
      priceCents: product.priceCents,
      groups: groups.map((group) => ({
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
    };
  }
}
