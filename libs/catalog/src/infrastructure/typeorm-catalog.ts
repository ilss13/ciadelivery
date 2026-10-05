import { DomainException } from '@ciadelivery/shared';
import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { EntityManager, FindOptionsWhere, In, Like } from 'typeorm';
import { CatalogRepository } from '../domain/catalog-repository';
import {
  CatalogScope,
  CategoryRecord,
  OptionGroupRecord,
  OptionRecord,
  Page,
  PageQuery,
  ProductListFilters,
  ProductRecord,
  toPage,
} from '../domain/catalog';
import {
  CategoryEntity,
  OptionEntity,
  OptionGroupEntity,
  ProductEntity,
} from './catalog.entities';

@Injectable()
export class TypeOrmCatalog implements CatalogRepository {
  constructor(private readonly database: DatabaseReady) {}

  async listCategories(
    scope: CatalogScope,
    page: PageQuery,
  ): Promise<Page<CategoryRecord>> {
    return this.pageCategories(scope, page, false);
  }

  async listActiveCategories(
    scope: CatalogScope,
    page: PageQuery,
  ): Promise<Page<CategoryRecord>> {
    return this.pageCategories(scope, page, true);
  }

  async findCategory(
    scope: CatalogScope,
    id: string,
  ): Promise<CategoryRecord | null> {
    const manager = await this.manager();
    const row = await manager.findOne(CategoryEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    return row === null ? null : toCategory(row);
  }

  async nextCategorySort(scope: CatalogScope): Promise<number> {
    return this.nextSort(CategoryEntity, scope);
  }

  async insertCategory(category: CategoryRecord): Promise<void> {
    const manager = await this.manager();
    await manager.insert(CategoryEntity, category);
  }

  async updateCategory(category: CategoryRecord): Promise<void> {
    const manager = await this.manager();
    await manager.update(
      CategoryEntity,
      {
        id: category.id,
        tenantId: category.tenantId,
        storeId: category.storeId,
      },
      {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        active: category.active,
        updatedAt: category.updatedAt,
      },
    );
  }

  async categoryHasProducts(
    scope: CatalogScope,
    categoryId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    const count = await this.manager(tx).count(ProductEntity, {
      where: {
        tenantId: scope.tenantId,
        storeId: scope.storeId,
        categoryId,
      },
    });
    return count > 0;
  }

  async deleteCategory(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    try {
      const result = await this.manager(tx).delete(CategoryEntity, {
        id,
        tenantId: scope.tenantId,
        storeId: scope.storeId,
      });
      return (result.affected ?? 0) > 0;
    } catch (error) {
      if (isMysqlForeignKey(error)) {
        throw new DomainException(
          'CATEGORY_NOT_EMPTY',
          'The category still has products',
          409,
        );
      }
      throw error;
    }
  }

  async listProducts(
    scope: CatalogScope,
    page: PageQuery,
    filters: ProductListFilters,
  ): Promise<Page<ProductRecord>> {
    const manager = await this.manager();
    const where: FindOptionsWhere<ProductEntity> = {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    };
    if (filters.categoryId !== undefined) {
      where.categoryId = filters.categoryId;
    }
    if (filters.active !== undefined) {
      where.active = filters.active;
    }
    if (filters.nameQuery !== undefined && filters.nameQuery.length > 0) {
      where.name = Like(`%${escapeLike(filters.nameQuery)}%`);
    }
    const [rows, total] = await manager.findAndCount(ProductEntity, {
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return toPage(rows.map(toProduct), total, page.page, page.pageSize);
  }

  async listPublicProducts(
    scope: CatalogScope,
    page: PageQuery,
    categoryId: string | undefined,
  ): Promise<Page<ProductRecord>> {
    const manager = await this.manager();
    const categories = await manager.find(CategoryEntity, {
      where: { tenantId: scope.tenantId, storeId: scope.storeId, active: true },
      select: { id: true },
    });
    const categoryIds = categories
      .map((category) => category.id)
      .filter((id) => categoryId === undefined || id === categoryId);
    if (categoryIds.length === 0) {
      return toPage([], 0, page.page, page.pageSize);
    }
    const [rows, total] = await manager.findAndCount(ProductEntity, {
      where: {
        tenantId: scope.tenantId,
        storeId: scope.storeId,
        active: true,
        categoryId: In(categoryIds),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return toPage(rows.map(toProduct), total, page.page, page.pageSize);
  }

  async findProduct(scope: CatalogScope, id: string): Promise<ProductRecord | null> {
    const manager = await this.manager();
    const row = await manager.findOne(ProductEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    return row === null ? null : toProduct(row);
  }

  async findPublicProduct(
    scope: CatalogScope,
    id: string,
  ): Promise<ProductRecord | null> {
    const product = await this.findProduct(scope, id);
    if (product === null || !product.active) {
      return null;
    }
    const category = await this.findCategory(scope, product.categoryId);
    if (category === null || !category.active) {
      return null;
    }
    return product;
  }

  async nextProductSort(scope: CatalogScope, categoryId: string): Promise<number> {
    return this.nextSort(ProductEntity, scope, { categoryId });
  }

  async insertProduct(product: ProductRecord): Promise<void> {
    const manager = await this.manager();
    await manager.insert(ProductEntity, product);
  }

  async updateProduct(
    product: ProductRecord,
    tx?: TransactionContext,
  ): Promise<void> {
    const manager = tx === undefined ? await this.manager() : this.manager(tx);
    await manager.update(
      ProductEntity,
      { id: product.id, tenantId: product.tenantId, storeId: product.storeId },
      {
        categoryId: product.categoryId,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        sku: product.sku,
        imageKey: product.imageKey,
        active: product.active,
        available: product.available,
        sortOrder: product.sortOrder,
        updatedAt: product.updatedAt,
      },
    );
  }

  async deleteProduct(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    const manager = this.manager(tx);
    const product = await manager.findOne(ProductEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    if (product === null) {
      return false;
    }
    const groups = await manager.find(OptionGroupEntity, {
      where: { productId: id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    await this.deleteGroups(manager, scope, groups.map((group) => group.id));
    const result = await manager.delete(ProductEntity, {
      id,
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    });
    return (result.affected ?? 0) > 0;
  }

  async listGroups(
    scope: CatalogScope,
    productId: string,
  ): Promise<OptionGroupRecord[]> {
    const manager = await this.manager();
    const rows = await manager.find(OptionGroupEntity, {
      where: { productId, tenantId: scope.tenantId, storeId: scope.storeId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toGroup);
  }

  async listGroupsForProducts(
    scope: CatalogScope,
    productIds: readonly string[],
  ): Promise<OptionGroupRecord[]> {
    if (productIds.length === 0) {
      return [];
    }
    const manager = await this.manager();
    const rows = await manager.find(OptionGroupEntity, {
      where: {
        tenantId: scope.tenantId,
        storeId: scope.storeId,
        productId: In([...productIds]),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toGroup);
  }

  async findGroup(scope: CatalogScope, id: string): Promise<OptionGroupRecord | null> {
    const manager = await this.manager();
    const row = await manager.findOne(OptionGroupEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    return row === null ? null : toGroup(row);
  }

  async nextGroupSort(scope: CatalogScope, productId: string): Promise<number> {
    return this.nextSort(OptionGroupEntity, scope, { productId });
  }

  async insertGroup(group: OptionGroupRecord): Promise<void> {
    const manager = await this.manager();
    await manager.insert(OptionGroupEntity, group);
  }

  async updateGroup(group: OptionGroupRecord): Promise<void> {
    const manager = await this.manager();
    await manager.update(
      OptionGroupEntity,
      { id: group.id, tenantId: group.tenantId, storeId: group.storeId },
      {
        name: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: group.sortOrder,
        updatedAt: group.updatedAt,
      },
    );
  }

  async deleteGroup(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    const manager = this.manager(tx);
    const group = await manager.findOne(OptionGroupEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    if (group === null) {
      return false;
    }
    await manager.delete(OptionEntity, {
      groupId: id,
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    });
    const result = await manager.delete(OptionGroupEntity, {
      id,
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    });
    return (result.affected ?? 0) > 0;
  }

  async listOptions(scope: CatalogScope, groupId: string): Promise<OptionRecord[]> {
    return this.listOptionsForGroups(scope, [groupId]);
  }

  async listOptionsForGroups(
    scope: CatalogScope,
    groupIds: readonly string[],
  ): Promise<OptionRecord[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const manager = await this.manager();
    const rows = await manager.find(OptionEntity, {
      where: {
        tenantId: scope.tenantId,
        storeId: scope.storeId,
        groupId: In([...groupIds]),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toOption);
  }

  async findOption(scope: CatalogScope, id: string): Promise<OptionRecord | null> {
    const manager = await this.manager();
    const row = await manager.findOne(OptionEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    return row === null ? null : toOption(row);
  }

  async nextOptionSort(scope: CatalogScope, groupId: string): Promise<number> {
    return this.nextSort(OptionEntity, scope, { groupId });
  }

  async insertOption(option: OptionRecord): Promise<void> {
    const manager = await this.manager();
    await manager.insert(OptionEntity, option);
  }

  async updateOption(option: OptionRecord): Promise<void> {
    const manager = await this.manager();
    await manager.update(
      OptionEntity,
      { id: option.id, tenantId: option.tenantId, storeId: option.storeId },
      {
        name: option.name,
        priceCents: option.priceCents,
        available: option.available,
        sortOrder: option.sortOrder,
        updatedAt: option.updatedAt,
      },
    );
  }

  async deleteOption(scope: CatalogScope, id: string): Promise<boolean> {
    const manager = await this.manager();
    const result = await manager.delete(OptionEntity, {
      id,
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    });
    return (result.affected ?? 0) > 0;
  }

  private async pageCategories(
    scope: CatalogScope,
    page: PageQuery,
    activeOnly: boolean,
  ): Promise<Page<CategoryRecord>> {
    const manager = await this.manager();
    const where: FindOptionsWhere<CategoryEntity> = {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    };
    if (activeOnly) {
      where.active = true;
    }
    const [rows, total] = await manager.findAndCount(CategoryEntity, {
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return toPage(rows.map(toCategory), total, page.page, page.pageSize);
  }

  private async nextSort(
    entity: typeof CategoryEntity,
    scope: CatalogScope,
  ): Promise<number>;
  private async nextSort(
    entity: typeof ProductEntity,
    scope: CatalogScope,
    extra: { categoryId: string },
  ): Promise<number>;
  private async nextSort(
    entity: typeof OptionGroupEntity,
    scope: CatalogScope,
    extra: { productId: string },
  ): Promise<number>;
  private async nextSort(
    entity: typeof OptionEntity,
    scope: CatalogScope,
    extra: { groupId: string },
  ): Promise<number>;
  private async nextSort(
    entity:
      | typeof CategoryEntity
      | typeof ProductEntity
      | typeof OptionGroupEntity
      | typeof OptionEntity,
    scope: CatalogScope,
    extra?: { categoryId?: string; productId?: string; groupId?: string },
  ): Promise<number> {
    const manager = await this.manager();
    const where: FindOptionsWhere<CategoryEntity> = {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    };
    if (extra?.categoryId !== undefined) {
      (where as FindOptionsWhere<ProductEntity>).categoryId = extra.categoryId;
    }
    if (extra?.productId !== undefined) {
      (where as FindOptionsWhere<OptionGroupEntity>).productId = extra.productId;
    }
    if (extra?.groupId !== undefined) {
      (where as FindOptionsWhere<OptionEntity>).groupId = extra.groupId;
    }
    const [row] = await manager.find(entity, {
      where,
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return row === undefined ? 0 : Number(row.sortOrder) + 1;
  }

  private async deleteGroups(
    manager: EntityManager,
    scope: CatalogScope,
    groupIds: string[],
  ): Promise<void> {
    if (groupIds.length === 0) {
      return;
    }
    await manager.delete(OptionEntity, {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      groupId: In(groupIds),
    });
    await manager.delete(OptionGroupEntity, {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      id: In(groupIds),
    });
  }

  private manager(tx: TransactionContext): EntityManager;
  private manager(): Promise<EntityManager>;
  private manager(
    tx?: TransactionContext,
  ): EntityManager | Promise<EntityManager> {
    if (tx !== undefined) {
      return tx as unknown as EntityManager;
    }
    return this.database.ensure().then((dataSource) => dataSource.manager);
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function isMysqlForeignKey(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as {
    code?: string;
    errno?: number;
    driverError?: { code?: string; errno?: number };
  };
  return (
    candidate.code === 'ER_ROW_IS_REFERENCED_2' ||
    candidate.errno === 1451 ||
    candidate.driverError?.code === 'ER_ROW_IS_REFERENCED_2' ||
    candidate.driverError?.errno === 1451
  );
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toCategory(row: CategoryEntity): CategoryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    name: row.name,
    description: row.description,
    sortOrder: Number(row.sortOrder),
    active: row.active,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function toProduct(row: ProductEntity): ProductRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    priceCents: Number(row.priceCents),
    sku: row.sku,
    imageKey: row.imageKey,
    active: row.active,
    available: row.available,
    sortOrder: Number(row.sortOrder),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function toGroup(row: OptionGroupEntity): OptionGroupRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    productId: row.productId,
    name: row.name,
    minSelect: Number(row.minSelect),
    maxSelect: Number(row.maxSelect),
    sortOrder: Number(row.sortOrder),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function toOption(row: OptionEntity): OptionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    groupId: row.groupId,
    name: row.name,
    priceCents: Number(row.priceCents),
    available: row.available,
    sortOrder: Number(row.sortOrder),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}
