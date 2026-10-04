import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'login_attempts' })
export class LoginAttemptEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @Column({
    type: 'tinyint',
    width: 1,
    transformer: {
      to: (value: boolean): number => (value ? 1 : 0),
      from: (value: number | boolean | null): boolean =>
        value === true || value === 1,
    },
  })
  succeeded!: boolean;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
