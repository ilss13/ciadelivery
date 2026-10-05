import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DeliveryFeeMode } from '../domain/delivery-fee';

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
  to: (value: boolean): number => (value ? 1 : 0),
  from: (value: number | boolean | null): boolean => value === true || value === 1,
};

@Entity({ name: 'delivery_configs' })
export class DeliveryConfigEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'delivery_enabled', type: 'tinyint', width: 1, transformer: flag })
  deliveryEnabled!: boolean;

  @Column({ name: 'pickup_enabled', type: 'tinyint', width: 1, transformer: flag })
  pickupEnabled!: boolean;

  @Column({
    name: 'max_radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimal,
  })
  maxRadiusKm!: number;

  @Column({ name: 'fee_mode', type: 'varchar', length: 8 })
  feeMode!: DeliveryFeeMode;

  @Column({ name: 'flat_fee_cents', type: 'int', unsigned: true })
  flatFeeCents!: number;

  @Column({ name: 'estimated_minutes', type: 'int', unsigned: true })
  estimatedMinutes!: number;

  @Column({
    name: 'origin_latitude',
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: decimal,
  })
  originLatitude!: number | null;

  @Column({
    name: 'origin_longitude',
    type: 'decimal',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: decimal,
  })
  originLongitude!: number | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'delivery_zones' })
export class DeliveryZoneEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({
    name: 'from_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimal,
  })
  fromKm!: number;

  @Column({
    name: 'to_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimal,
  })
  toKm!: number;

  @Column({ name: 'fee_cents', type: 'int', unsigned: true })
  feeCents!: number;

  @Column({ name: 'sort_order', type: 'int', unsigned: true })
  sortOrder!: number;
}
