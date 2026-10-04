import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'leads' })
export class LeadEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ name: 'establishment_name', type: 'varchar', length: 160 })
  establishmentName!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
