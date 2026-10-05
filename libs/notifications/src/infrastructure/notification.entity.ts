import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  body!: string;

  @Column({ name: 'order_id', type: 'char', length: 36, nullable: true })
  orderId!: string | null;

  @Column({ name: 'event_id', type: 'char', length: 36, nullable: true })
  eventId!: string | null;

  @Column({ name: 'read_at', type: 'datetime', precision: 3, nullable: true })
  readAt!: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
