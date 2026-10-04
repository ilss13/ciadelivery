import { DomainException } from '@ciadelivery/shared';

export interface CatalogScope {
  tenantId: string;
  storeId: string;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryRecord {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRecord {
  id: string;
  tenantId: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  imageKey: string | null;
  active: boolean;
  available: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptionGroupRecord {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptionRecord {
  id: string;
  tenantId: string;
  storeId: string;
  groupId: string;
  name: string;
  priceCents: number;
  available: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryView {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductView {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  active: boolean;
  available: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptionView {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  sortOrder: number;
}

export interface OptionGroupView {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: OptionView[];
}

export interface ProductDetailView extends ProductView {
  optionGroups: OptionGroupView[];
}

export interface ProductListFilters {
  categoryId?: string;
  active?: boolean;
  nameQuery?: string;
}

const MAX_PRICE_CENTS = 2147483647;

export function assertPriceCents(priceCents: number): void {
  if (
    !Number.isInteger(priceCents) ||
    priceCents < 0 ||
    priceCents > MAX_PRICE_CENTS
  ) {
    throw new DomainException(
      'INVALID_PRICE',
      'The price must be zero or greater',
      400,
    );
  }
}

export function assertOptionSelection(minSelect: number, maxSelect: number): void {
  if (
    !Number.isInteger(minSelect) ||
    !Number.isInteger(maxSelect) ||
    minSelect < 0 ||
    maxSelect < 1 ||
    minSelect > maxSelect
  ) {
    throw new DomainException(
      'INVALID_OPTION_GROUP',
      'The option group selection range is invalid',
      400,
    );
  }
}

export function toPage<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Page<T> {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export function toCategoryView(category: CategoryRecord): CategoryView {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    active: category.active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export type ImageUrlResolver = (key: string) => string;

export function toProductView(
  product: ProductRecord,
  imageUrlFor?: ImageUrlResolver,
): ProductView {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    sku: product.sku,
    imageKey: product.imageKey,
    imageUrl:
      product.imageKey === null || imageUrlFor === undefined
        ? null
        : imageUrlFor(product.imageKey),
    active: product.active,
    available: product.available,
    sortOrder: product.sortOrder,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function toOptionView(option: OptionRecord): OptionView {
  return {
    id: option.id,
    name: option.name,
    priceCents: option.priceCents,
    available: option.available,
    sortOrder: option.sortOrder,
  };
}

export function toOptionGroupView(
  group: OptionGroupRecord,
  options: readonly OptionRecord[],
): OptionGroupView {
  return {
    id: group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    sortOrder: group.sortOrder,
    options: options.filter((option) => option.groupId === group.id).map(toOptionView),
  };
}

export function attachOptionGroups(
  products: readonly ProductRecord[],
  groups: readonly OptionGroupRecord[],
  options: readonly OptionRecord[],
  imageUrlFor?: ImageUrlResolver,
): ProductDetailView[] {
  return products.map((product) => ({
    ...toProductView(product, imageUrlFor),
    optionGroups: groups
      .filter((group) => group.productId === product.id)
      .map((group) => toOptionGroupView(group, options)),
  }));
}
