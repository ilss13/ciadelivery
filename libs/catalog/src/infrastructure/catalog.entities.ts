import { Column, Entity, PrimaryColumn } from 'typeorm';

export const flag = {
  type: 'tinyint' as const,
  width: 1,
  transformer: {
    to: (value: boolean): number => (value ? 1 : 0),
    from: (value: number | boolean | null): boolean =>
      value === true || value === 1,
  },
};

@Entity({ name: 'categories' })
export class CategoryEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder!: number;

  @Column({ ...flag })
  active!: boolean;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'category_id', type: 'char', length: 36 })
  categoryId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku!: string | null;

  @Column({ name: 'image_key', type: 'varchar', length: 500, nullable: true })
  imageKey!: string | null;

  @Column({ ...flag })
  active!: boolean;

  @Column({ ...flag })
  available!: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder!: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'product_option_groups' })
export class OptionGroupEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'product_id', type: 'char', length: 36 })
  productId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'min_select', type: 'int' })
  minSelect!: number;

  @Column({ name: 'max_select', type: 'int' })
  maxSelect!: number;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder!: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'product_options' })
export class OptionEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'group_id', type: 'char', length: 36 })
  groupId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'price_cents', type: 'int' })
  priceCents!: number;

  @Column({ ...flag })
  available!: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder!: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
