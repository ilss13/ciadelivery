import { Permission, PermissionOverride, Role } from './permissions';

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserAccount {
  id: string;
  tenantId: string | null;
  storeId: string | null;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  tenantId: string | null;
  storeId: string | null;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestActor {
  userId: string;
  role: Role;
  tenantId: string | null;
  storeId: string | null;
  permissions: readonly Permission[];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toProfile(
  user: UserAccount,
  permissions: Permission[],
): UserProfile {
  return {
    id: user.id,
    tenantId: user.tenantId,
    storeId: user.storeId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type { PermissionOverride };
