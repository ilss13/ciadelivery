import { Column, Entity, PrimaryColumn } from 'typeorm';
import { TenantStatus } from '../domain/tenant';

@Entity({ name: 'tenants' })
export class TenantEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 63 })
  slug!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: TenantStatus;

  @Column({ name: 'plan_code', type: 'varchar', length: 40 })
  planCode!: string;

  @Column({
    name: 'custom_domain',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  customDomain!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
