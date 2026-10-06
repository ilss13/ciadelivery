import { TransactionContext } from '@ciadelivery/tenancy/domain';
import {
  CatalogScope,
  CategoryRecord,
  OptionGroupRecord,
  OptionRecord,
  Page,
  PageQuery,
  ProductListFilters,
  ProductRecord,
} from './catalog';

export interface CatalogRepository {
  listCategories(scope: CatalogScope, page: PageQuery): Promise<Page<CategoryRecord>>;
  listActiveCategories(
    scope: CatalogScope,
    page: PageQuery,
  ): Promise<Page<CategoryRecord>>;
  findCategory(scope: CatalogScope, id: string): Promise<CategoryRecord | null>;
  nextCategorySort(scope: CatalogScope, tx?: TransactionContext): Promise<number>;
  insertCategory(category: CategoryRecord, tx?: TransactionContext): Promise<void>;
  updateCategory(category: CategoryRecord): Promise<void>;
  categoryHasProducts(
    scope: CatalogScope,
    categoryId: string,
    tx: TransactionContext,
  ): Promise<boolean>;
  deleteCategory(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean>;

  listProducts(
    scope: CatalogScope,
    page: PageQuery,
    filters: ProductListFilters,
  ): Promise<Page<ProductRecord>>;
  listPublicProducts(
    scope: CatalogScope,
    page: PageQuery,
    categoryId: string | undefined,
  ): Promise<Page<ProductRecord>>;
  findProduct(scope: CatalogScope, id: string): Promise<ProductRecord | null>;
  findPublicProduct(scope: CatalogScope, id: string): Promise<ProductRecord | null>;
  nextProductSort(
    scope: CatalogScope,
    categoryId: string,
    tx?: TransactionContext,
  ): Promise<number>;
  insertProduct(product: ProductRecord, tx?: TransactionContext): Promise<void>;
  updateProduct(product: ProductRecord, tx?: TransactionContext): Promise<void>;
  deleteProduct(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean>;

  listGroups(scope: CatalogScope, productId: string): Promise<OptionGroupRecord[]>;
  listGroupsForProducts(
    scope: CatalogScope,
    productIds: readonly string[],
  ): Promise<OptionGroupRecord[]>;
  findGroup(scope: CatalogScope, id: string): Promise<OptionGroupRecord | null>;
  nextGroupSort(
    scope: CatalogScope,
    productId: string,
    tx?: TransactionContext,
  ): Promise<number>;
  insertGroup(group: OptionGroupRecord, tx?: TransactionContext): Promise<void>;
  updateGroup(group: OptionGroupRecord): Promise<void>;
  deleteGroup(
    scope: CatalogScope,
    id: string,
    tx: TransactionContext,
  ): Promise<boolean>;

  listOptions(scope: CatalogScope, groupId: string): Promise<OptionRecord[]>;
  listOptionsForGroups(
    scope: CatalogScope,
    groupIds: readonly string[],
  ): Promise<OptionRecord[]>;
  findOption(scope: CatalogScope, id: string): Promise<OptionRecord | null>;
  nextOptionSort(
    scope: CatalogScope,
    groupId: string,
    tx?: TransactionContext,
  ): Promise<number>;
  insertOption(option: OptionRecord, tx?: TransactionContext): Promise<void>;
  updateOption(option: OptionRecord): Promise<void>;
  deleteOption(scope: CatalogScope, id: string): Promise<boolean>;
}

export const CATALOG = Symbol('CATALOG');
