import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { PermissionOverride } from './permissions';
import { UserAccount } from './user';

export interface Users {
  insert(
    user: UserAccount,
    overrides: readonly PermissionOverride[],
    tx: TransactionContext,
  ): Promise<void>;
  update(
    user: UserAccount,
    overrides: readonly PermissionOverride[] | null,
    tx: TransactionContext,
  ): Promise<void>;
  updatePassword(
    userId: string,
    passwordHash: string,
    updatedAt: Date,
    tx: TransactionContext,
  ): Promise<void>;
  findById(id: string, tx?: TransactionContext): Promise<UserAccount | null>;
  findByEmail(email: string): Promise<UserAccount | null>;
  findByIdInTenant(
    id: string,
    tenantId: string,
  ): Promise<UserAccount | null>;
  listByTenant(
    tenantId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: UserAccount[]; total: number }>;
  listOverrides(userId: string): Promise<PermissionOverride[]>;
  listOverridesForUsers(
    userIds: readonly string[],
  ): Promise<Map<string, PermissionOverride[]>>;
  existsOwner(tenantId: string, tx: TransactionContext): Promise<boolean>;
  countActiveOwners(tenantId: string, tx: TransactionContext): Promise<number>;
}

export const USERS = Symbol('USERS');
