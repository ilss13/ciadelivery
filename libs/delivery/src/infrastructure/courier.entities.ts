import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AssignmentStatus } from '../domain/assignment';
import { CourierStatus } from '../domain/courier';

const flag = {
  to: (value: boolean): number => (value ? 1 : 0),
  from: (value: number | boolean | null): boolean => value === true || value === 1,
};

@Entity({ name: 'couriers' })
export class CourierEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  phone!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: CourierStatus;

  @Column({ type: 'tinyint', width: 1, transformer: flag })
  active!: boolean;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 40, nullable: true })
  vehicleType!: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'delivery_assignments' })
export class DeliveryAssignmentEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'char', length: 36 })
  orderId!: string;

  @Column({ name: 'courier_id', type: 'char', length: 36 })
  courierId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: AssignmentStatus;

  @Column({ name: 'assigned_by', type: 'char', length: 36 })
  assignedBy!: string;

  @Column({ name: 'assigned_at', type: 'datetime', precision: 3 })
  assignedAt!: Date;

  @Column({ name: 'out_at', type: 'datetime', precision: 3, nullable: true })
  outAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'datetime', precision: 3, nullable: true })
  deliveredAt!: Date | null;
}
