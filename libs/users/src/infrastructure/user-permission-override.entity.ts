import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Permission } from '../domain/permissions';

@Entity({ name: 'user_permission_overrides' })
export class UserPermissionOverrideEntity {
  @PrimaryColumn({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  permission!: Permission;

  @Column({
    type: 'tinyint',
    width: 1,
    transformer: {
      to: (value: boolean): number => (value ? 1 : 0),
      from: (value: number | boolean | null): boolean =>
        value === true || value === 1,
    },
  })
  granted!: boolean;
}
