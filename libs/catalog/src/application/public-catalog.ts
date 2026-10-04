import { DomainException, StorageProvider } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { requirePublicStore } from './actor-store';
import {
  CatalogScope,
  CategoryView,
  Page,
  ProductDetailView,
  toCategoryView,
  attachOptionGroups,
} from '../domain/catalog';
import { CatalogRepository } from '../domain/catalog-repository';

export class PublicCatalog {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly stores: CurrentStore,
    private readonly storage: StorageProvider,
  ) {}

  async listCategories(
    page: number,
    pageSize: number,
  ): Promise<Page<CategoryView>> {
    const scope = await this.scope();
    const listed = await this.catalog.listActiveCategories(scope, {
      page,
      pageSize,
    });
    return { data: listed.data.map(toCategoryView), meta: listed.meta };
  }

  async listProducts(
    page: number,
    pageSize: number,
    categoryId: string | undefined,
  ): Promise<Page<ProductDetailView>> {
    const scope = await this.scope();
    const listed = await this.catalog.listPublicProducts(
      scope,
      { page, pageSize },
      categoryId,
    );
    return {
      data: await this.withGroups(scope, listed.data),
      meta: listed.meta,
    };
  }

  async getProduct(id: string): Promise<ProductDetailView> {
    const scope = await this.scope();
    const product = await this.catalog.findPublicProduct(scope, id);
    if (product === null) {
      throw new DomainException(
        'PRODUCT_NOT_FOUND',
        'The product was not found',
        404,
      );
    }
    const [detailed] = await this.withGroups(scope, [product]);
    if (detailed === undefined) {
      throw new DomainException(
        'PRODUCT_NOT_FOUND',
        'The product was not found',
        404,
      );
    }
    return detailed;
  }

  private async scope(): Promise<CatalogScope> {
    const store = await requirePublicStore(this.stores);
    return { tenantId: store.tenantId, storeId: store.id };
  }

  private async withGroups(
    scope: CatalogScope,
    products: Parameters<typeof attachOptionGroups>[0],
  ): Promise<ProductDetailView[]> {
    const groups = await this.catalog.listGroupsForProducts(
      scope,
      products.map((product) => product.id),
    );
    const options = await this.catalog.listOptionsForGroups(
      scope,
      groups.map((group) => group.id),
    );
    return attachOptionGroups(products, groups, options, (key) =>
      this.storage.publicUrl(key),
    );
  }
}
