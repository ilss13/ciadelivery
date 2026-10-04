import { randomUUID } from 'node:crypto';
import {
  discardStoredFile,
  DomainException,
  FileInput,
  StorageProvider,
  StoredFile,
  WarningLog,
} from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { requireActorStore } from './actor-store';
import {
  CatalogScope,
  CategoryRecord,
  CategoryView,
  OptionGroupRecord,
  OptionRecord,
  OptionView,
  Page,
  ProductDetailView,
  ProductListFilters,
  ProductRecord,
  ProductView,
  assertOptionSelection,
  assertPriceCents,
  attachOptionGroups,
  toCategoryView,
  toOptionGroupView,
  toOptionView,
  toProductView,
} from '../domain/catalog';
import { CatalogRepository } from '../domain/catalog-repository';

export interface CategoryInput {
  name: string;
  description: string | null;
  sortOrder?: number;
  active: boolean;
}

export interface CategoryPatch {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export interface ProductInput {
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  active: boolean;
  available: boolean;
  sortOrder?: number;
}

export interface ProductPatch {
  categoryId?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  sku?: string | null;
  active?: boolean;
  available?: boolean;
  sortOrder?: number;
}

export interface OptionGroupInput {
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
}

export interface OptionGroupPatch {
  name?: string;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
}

export interface OptionInput {
  name: string;
  priceCents: number;
  available: boolean;
  sortOrder?: number;
}

export interface OptionPatch {
  name?: string;
  priceCents?: number;
  available?: boolean;
  sortOrder?: number;
}

export class AdminCatalog {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly stores: CurrentStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly storage: StorageProvider,
    private readonly log: WarningLog,
  ) {}

  async listCategories(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<Page<CategoryView>> {
    const scope = await this.scope(actor);
    const listed = await this.catalog.listCategories(scope, { page, pageSize });
    return { data: listed.data.map(toCategoryView), meta: listed.meta };
  }

  async createCategory(
    actor: RequestActor,
    input: CategoryInput,
  ): Promise<CategoryView> {
    const scope = await this.scope(actor);
    const now = new Date();
    const category: CategoryRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder ?? (await this.catalog.nextCategorySort(scope)),
      active: input.active,
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertCategory(category);
    return toCategoryView(category);
  }

  async updateCategory(
    actor: RequestActor,
    id: string,
    patch: CategoryPatch,
  ): Promise<CategoryView> {
    const scope = await this.scope(actor);
    const current = await this.requireCategory(scope, id);
    const next: CategoryRecord = {
      ...current,
      updatedAt: new Date(),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
      ...(patch.active === undefined ? {} : { active: patch.active }),
    };
    await this.catalog.updateCategory(next);
    return toCategoryView(next);
  }

  async deleteCategory(actor: RequestActor, id: string): Promise<void> {
    const scope = await this.scope(actor);
    await this.unitOfWork.run(async (tx) => {
      const current = await this.catalog.findCategory(scope, id);
      if (current === null) {
        throw categoryNotFound();
      }
      if (await this.catalog.categoryHasProducts(scope, id, tx)) {
        throw new DomainException(
          'CATEGORY_NOT_EMPTY',
          'The category still has products',
          409,
        );
      }
      const removed = await this.catalog.deleteCategory(scope, id, tx);
      if (!removed) {
        throw categoryNotFound();
      }
    });
  }

  async listProducts(
    actor: RequestActor,
    page: number,
    pageSize: number,
    filters: ProductListFilters,
  ): Promise<Page<ProductView>> {
    const scope = await this.scope(actor);
    const listed = await this.catalog.listProducts(scope, { page, pageSize }, filters);
    return {
      data: listed.data.map((product) => toProductView(product, this.imageUrl)),
      meta: listed.meta,
    };
  }

  async getProduct(actor: RequestActor, id: string): Promise<ProductDetailView> {
    const scope = await this.scope(actor);
    const product = await this.requireProduct(scope, id);
    const [detailed] = await this.withGroups(scope, [product]);
    if (detailed === undefined) {
      throw productNotFound();
    }
    return detailed;
  }

  async createProduct(
    actor: RequestActor,
    input: ProductInput,
  ): Promise<ProductDetailView> {
    assertPriceCents(input.priceCents);
    const scope = await this.scope(actor);
    await this.requireCategory(scope, input.categoryId);
    const now = new Date();
    const product: ProductRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      sku: input.sku,
      imageKey: null,
      active: input.active,
      available: input.available,
      sortOrder:
        input.sortOrder ??
        (await this.catalog.nextProductSort(scope, input.categoryId)),
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertProduct(product);
    return { ...toProductView(product, this.imageUrl), optionGroups: [] };
  }

  async updateProduct(
    actor: RequestActor,
    id: string,
    patch: ProductPatch,
  ): Promise<ProductDetailView> {
    if (patch.priceCents !== undefined) {
      assertPriceCents(patch.priceCents);
    }
    const scope = await this.scope(actor);
    const current = await this.requireProduct(scope, id);
    if (patch.categoryId !== undefined) {
      await this.requireCategory(scope, patch.categoryId);
    }
    const next: ProductRecord = {
      ...current,
      updatedAt: new Date(),
      ...(patch.categoryId === undefined ? {} : { categoryId: patch.categoryId }),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.description === undefined
        ? {}
        : { description: patch.description }),
      ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
      ...(patch.sku === undefined ? {} : { sku: patch.sku }),
      ...(patch.active === undefined ? {} : { active: patch.active }),
      ...(patch.available === undefined ? {} : { available: patch.available }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
    };
    await this.catalog.updateProduct(next);
    const [detailed] = await this.withGroups(scope, [next]);
    if (detailed === undefined) {
      throw productNotFound();
    }
    return detailed;
  }

  async deleteProduct(actor: RequestActor, id: string): Promise<void> {
    const scope = await this.scope(actor);
    const current = await this.requireProduct(scope, id);
    await this.unitOfWork.run(async (tx) => {
      const removed = await this.catalog.deleteProduct(scope, id, tx);
      if (!removed) {
        throw productNotFound();
      }
    });
    await discardStoredFile(
      this.storage,
      scope.tenantId,
      current.imageKey,
      null,
      this.log,
    );
  }

  async uploadProductImage(
    actor: RequestActor,
    id: string,
    file: FileInput,
  ): Promise<StoredFile> {
    const scope = await this.scope(actor);
    const current = await this.requireProduct(scope, id);
    const stored = await this.storage.upload({
      ...file,
      tenantId: scope.tenantId,
      kind: 'products',
    });
    await this.catalog.updateProduct({
      ...current,
      imageKey: stored.key,
      updatedAt: new Date(),
    });
    await discardStoredFile(
      this.storage,
      scope.tenantId,
      current.imageKey,
      stored.key,
      this.log,
    );
    return stored;
  }

  async deleteProductImage(actor: RequestActor, id: string): Promise<void> {
    const scope = await this.scope(actor);
    const current = await this.requireProduct(scope, id);
    if (current.imageKey === null) {
      return;
    }
    await this.catalog.updateProduct({
      ...current,
      imageKey: null,
      updatedAt: new Date(),
    });
    await discardStoredFile(
      this.storage,
      scope.tenantId,
      current.imageKey,
      null,
      this.log,
    );
  }

  async createOptionGroup(
    actor: RequestActor,
    productId: string,
    input: OptionGroupInput,
  ): Promise<ProductDetailView['optionGroups'][number]> {
    assertOptionSelection(input.minSelect, input.maxSelect);
    const scope = await this.scope(actor);
    await this.requireProduct(scope, productId);
    const now = new Date();
    const group: OptionGroupRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      productId,
      name: input.name,
      minSelect: input.minSelect,
      maxSelect: input.maxSelect,
      sortOrder:
        input.sortOrder ?? (await this.catalog.nextGroupSort(scope, productId)),
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertGroup(group);
    return toOptionGroupView(group, []);
  }

  async updateOptionGroup(
    actor: RequestActor,
    productId: string,
    groupId: string,
    patch: OptionGroupPatch,
  ): Promise<ProductDetailView['optionGroups'][number]> {
    const scope = await this.scope(actor);
    const current = await this.requireGroup(scope, productId, groupId);
    const minSelect = patch.minSelect ?? current.minSelect;
    const maxSelect = patch.maxSelect ?? current.maxSelect;
    assertOptionSelection(minSelect, maxSelect);
    const next: OptionGroupRecord = {
      ...current,
      minSelect,
      maxSelect,
      updatedAt: new Date(),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
    };
    await this.catalog.updateGroup(next);
    const options = await this.catalog.listOptions(scope, groupId);
    return toOptionGroupView(next, options);
  }

  async deleteOptionGroup(
    actor: RequestActor,
    productId: string,
    groupId: string,
  ): Promise<void> {
    const scope = await this.scope(actor);
    await this.requireGroup(scope, productId, groupId);
    await this.unitOfWork.run(async (tx) => {
      const removed = await this.catalog.deleteGroup(scope, groupId, tx);
      if (!removed) {
        throw optionGroupNotFound();
      }
    });
  }

  async createOption(
    actor: RequestActor,
    productId: string,
    groupId: string,
    input: OptionInput,
  ): Promise<OptionView> {
    assertPriceCents(input.priceCents);
    const scope = await this.scope(actor);
    await this.requireGroup(scope, productId, groupId);
    const now = new Date();
    const option: OptionRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      groupId,
      name: input.name,
      priceCents: input.priceCents,
      available: input.available,
      sortOrder:
        input.sortOrder ?? (await this.catalog.nextOptionSort(scope, groupId)),
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertOption(option);
    return toOptionView(option);
  }

  async updateOption(
    actor: RequestActor,
    groupId: string,
    optionId: string,
    patch: OptionPatch,
  ): Promise<OptionView> {
    if (patch.priceCents !== undefined) {
      assertPriceCents(patch.priceCents);
    }
    const scope = await this.scope(actor);
    const current = await this.requireOption(scope, groupId, optionId);
    const next: OptionRecord = {
      ...current,
      updatedAt: new Date(),
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
      ...(patch.available === undefined ? {} : { available: patch.available }),
      ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
    };
    await this.catalog.updateOption(next);
    return toOptionView(next);
  }

  async deleteOption(
    actor: RequestActor,
    groupId: string,
    optionId: string,
  ): Promise<void> {
    const scope = await this.scope(actor);
    await this.requireOption(scope, groupId, optionId);
    const removed = await this.catalog.deleteOption(scope, optionId);
    if (!removed) {
      throw optionNotFound();
    }
  }

  private async scope(actor: RequestActor): Promise<CatalogScope> {
    const store = await requireActorStore(actor, this.stores);
    return { tenantId: store.tenantId, storeId: store.id };
  }

  private async requireCategory(
    scope: CatalogScope,
    id: string,
  ): Promise<CategoryRecord> {
    const category = await this.catalog.findCategory(scope, id);
    if (category === null) {
      throw categoryNotFound();
    }
    return category;
  }

  private async requireProduct(
    scope: CatalogScope,
    id: string,
  ): Promise<ProductRecord> {
    const product = await this.catalog.findProduct(scope, id);
    if (product === null) {
      throw productNotFound();
    }
    return product;
  }

  private async requireGroup(
    scope: CatalogScope,
    productId: string,
    groupId: string,
  ): Promise<OptionGroupRecord> {
    const group = await this.catalog.findGroup(scope, groupId);
    if (group === null || group.productId !== productId) {
      throw optionGroupNotFound();
    }
    return group;
  }

  private async requireOption(
    scope: CatalogScope,
    groupId: string,
    optionId: string,
  ): Promise<OptionRecord> {
    const option = await this.catalog.findOption(scope, optionId);
    if (option === null || option.groupId !== groupId) {
      throw optionNotFound();
    }
    return option;
  }

  private async withGroups(
    scope: CatalogScope,
    products: ProductRecord[],
  ): Promise<ProductDetailView[]> {
    const groups = await this.catalog.listGroupsForProducts(
      scope,
      products.map((product) => product.id),
    );
    const options = await this.catalog.listOptionsForGroups(
      scope,
      groups.map((group) => group.id),
    );
    return attachOptionGroups(products, groups, options, this.imageUrl);
  }

  private readonly imageUrl = (key: string): string => this.storage.publicUrl(key);
}

function categoryNotFound(): DomainException {
  return new DomainException(
    'CATEGORY_NOT_FOUND',
    'The category was not found',
    404,
  );
}

function productNotFound(): DomainException {
  return new DomainException(
    'PRODUCT_NOT_FOUND',
    'The product was not found',
    404,
  );
}

function optionGroupNotFound(): DomainException {
  return new DomainException(
    'OPTION_GROUP_NOT_FOUND',
    'The option group was not found',
    404,
  );
}

function optionNotFound(): DomainException {
  return new DomainException(
    'OPTION_NOT_FOUND',
    'The option was not found',
    404,
  );
}
