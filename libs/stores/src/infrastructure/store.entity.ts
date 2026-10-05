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

@Entity({ name: 'stores' })
export class StoreEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ name: 'address_line', type: 'varchar', length: 160 })
  addressLine!: string;

  @Column({ name: 'address_number', type: 'varchar', length: 20 })
  addressNumber!: string;

  @Column({ type: 'varchar', length: 80 })
  district!: string;

  @Column({ type: 'varchar', length: 80 })
  city!: string;

  @Column({ type: 'varchar', length: 40 })
  state!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
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

  @Column({
    name: 'minimum_order_cents',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  minimumOrderCents!: number;

  @Column({
    name: 'is_manually_closed',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean): number => (value ? 1 : 0),
      from: (value: number | boolean | null): boolean =>
        value === true || value === 1,
    },
  })
  isManuallyClosed!: boolean;

  @Column({ type: 'varchar', length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;

  @Column({
    name: 'estimated_prep_minutes',
    type: 'int',
    unsigned: true,
    default: 40,
  })
  estimatedPrepMinutes!: number;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
