import { Column, Entity, PrimaryColumn } from 'typeorm';
import { OutboxStatus } from '../domain/outbox';

@Entity({ name: 'outbox_events' })
export class OutboxEventEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 32 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'char', length: 36 })
  aggregateId!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: string;

  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16 })
  status!: OutboxStatus;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts!: number;

  @Column({ name: 'available_at', type: 'datetime', precision: 3 })
  availableAt!: Date;

  @Column({ name: 'processed_at', type: 'datetime', precision: 3, nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError!: string | null;

  @Column({ name: 'locked_by', type: 'char', length: 36, nullable: true })
  lockedBy!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'processed_events' })
export class ProcessedEventEntity {
  @PrimaryColumn({ name: 'event_id', type: 'char', length: 36 })
  eventId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  handler!: string;

  @Column({ name: 'processed_at', type: 'datetime', precision: 3 })
  processedAt!: Date;
}
