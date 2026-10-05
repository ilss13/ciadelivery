import { Column, Entity, PrimaryColumn } from 'typeorm';

const decimal = {
  to: (value: number | null): number | null => value,
  from: (value: string | number | null): number | null => {
    if (value === null) {
      return null;
    }

    return typeof value === 'number' ? value : Number(value);
  },
};

const flag = {
  type: 'tinyint' as const,
  width: 1,
  transformer: {
    to: (value: boolean): number => (value ? 1 : 0),
    from: (value: number | boolean | null): boolean =>
      value === true || value === 1,
  },
};

@Entity({ name: 'customers' })
export class CustomerEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  phone!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'customer_addresses' })
export class CustomerAddressEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  label!: string | null;

  @Column({ name: 'address_line', type: 'varchar', length: 160 })
  line!: string;

  @Column({ name: 'address_number', type: 'varchar', length: 20 })
  number!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  complement!: string | null;

  @Column({ type: 'varchar', length: 80 })
  district!: string;

  @Column({ type: 'varchar', length: 80 })
  city!: string;

  @Column({ type: 'char', length: 2 })
  state!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 16 })
  postalCode!: string;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: decimal,
  })
  latitude!: number | null;

  @Column({
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: decimal,
  })
  longitude!: number | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'customer_consents' })
export class CustomerConsentEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @Column({ type: 'varchar', length: 16 })
  purpose!: 'OPERATIONAL' | 'MARKETING';

  @Column({ ...flag })
  granted!: boolean;

  @Column({ name: 'policy_version', type: 'varchar', length: 32 })
  policyVersion!: string;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 512 })
  userAgent!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'payment_methods' })
export class PaymentMethodEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  instructions!: string | null;

  @Column({ ...flag })
  enabled!: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder!: number;
}
