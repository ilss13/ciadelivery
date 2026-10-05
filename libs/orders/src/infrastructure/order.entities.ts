import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Fulfillment } from '../domain/delivery-quote';
import { OrderAddress, OrderOptionSnapshot } from '../domain/order';
import { OrderStatus } from '../domain/order-status';
import { CreatedOrder } from '../domain/order';

@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @Column({ name: 'order_number', type: 'int', unsigned: true })
  orderNumber!: number;

  @Column({ type: 'varchar', length: 32 })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 16 })
  fulfillment!: Fulfillment;

  @Column({ name: 'payment_method_code', type: 'varchar', length: 32 })
  paymentMethodCode!: string;

  @Column({ name: 'payment_label', type: 'varchar', length: 80 })
  paymentLabel!: string;

  @Column({ name: 'payment_instructions', type: 'varchar', length: 500, nullable: true })
  paymentInstructions!: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 160 })
  customerName!: string;

  @Column({ name: 'customer_phone', type: 'varchar', length: 16 })
  customerPhone!: string;

  @Column({ name: 'address_snapshot', type: 'json', nullable: true })
  addressSnapshot!: OrderAddress | null;

  @Column({ name: 'subtotal_cents', type: 'int', unsigned: true })
  subtotalCents!: number;

  @Column({ name: 'delivery_fee_cents', type: 'int', unsigned: true })
  deliveryFeeCents!: number;

  @Column({ name: 'total_cents', type: 'int', unsigned: true })
  totalCents!: number;

  @Column({ type: 'varchar', length: 280, nullable: true })
  notes!: string | null;

  @Column({ name: 'tracking_token_hash', type: 'char', length: 64 })
  trackingTokenHash!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'order_items' })
export class OrderItemEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'char', length: 36 })
  orderId!: string;

  @Column({ type: 'int', unsigned: true })
  position!: number;

  @Column({ name: 'product_id', type: 'char', length: 36, nullable: true })
  productId!: string | null;

  @Column({ name: 'product_name', type: 'varchar', length: 160 })
  productName!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku!: string | null;

  @Column({ name: 'unit_price_cents', type: 'int', unsigned: true })
  unitPriceCents!: number;

  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  @Column({ type: 'varchar', length: 280, nullable: true })
  notes!: string | null;

  @Column({ name: 'options_snapshot', type: 'json' })
  optionsSnapshot!: OrderOptionSnapshot[];

  @Column({ name: 'subtotal_cents', type: 'int', unsigned: true })
  subtotalCents!: number;
}

@Entity({ name: 'order_status_history' })
export class OrderStatusHistoryEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'char', length: 36 })
  orderId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32 })
  toStatus!: OrderStatus;

  @Column({ name: 'actor_type', type: 'varchar', length: 16 })
  actorType!: 'CUSTOMER' | 'USER' | 'SYSTEM';

  @Column({ name: 'actor_id', type: 'char', length: 36, nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  note!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'idempotency_records' })
export class IdempotencyRecordEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @PrimaryColumn({ name: 'key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash!: string;

  @Column({ name: 'status_code', type: 'smallint' })
  statusCode!: number;

  @Column({ name: 'response_body', type: 'json', nullable: true })
  responseBody!: CreatedOrder | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
