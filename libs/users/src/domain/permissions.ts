import { DomainException } from '@ciadelivery/shared';

export const PERMISSIONS = [
  'users.manage',
  'catalog.manage',
  'orders.read',
  'orders.accept',
  'orders.prepare',
  'orders.assign_courier',
  'orders.deliver',
  'store.configure',
  'customers.read',
  'couriers.manage',
  'whatsapp.operate',
  'reports.read',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'ATTENDANT',
  'KITCHEN',
  'COURIER',
] as const;

export type Role = (typeof ROLES)[number];

export const TENANT_ROLES = [
  'OWNER',
  'MANAGER',
  'ATTENDANT',
  'KITCHEN',
  'COURIER',
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

const ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: [
    'catalog.manage',
    'orders.read',
    'orders.accept',
    'orders.prepare',
    'orders.assign_courier',
    'orders.deliver',
    'customers.read',
    'couriers.manage',
    'whatsapp.operate',
    'reports.read',
  ],
  ATTENDANT: [
    'orders.read',
    'orders.accept',
    'orders.prepare',
    'orders.assign_courier',
    'customers.read',
    'whatsapp.operate',
  ],
  KITCHEN: ['orders.read', 'orders.prepare'],
  COURIER: ['orders.read', 'orders.deliver'],
};

export interface PermissionOverride {
  permission: Permission;
  granted: boolean;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isTenantRole(value: string): value is TenantRole {
  return (TENANT_ROLES as readonly string[]).includes(value);
}

export function effectivePermissions(
  role: Role,
  overrides: readonly PermissionOverride[],
): Permission[] {
  if (role === 'SUPER_ADMIN') {
    return [];
  }

  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const override of overrides) {
    if (override.granted) {
      granted.add(override.permission);
    } else {
      granted.delete(override.permission);
    }
  }

  return [...granted].sort();
}

export function assertAssignablePermissions(
  actor: { role: Role; permissions: readonly Permission[] },
  role: Role,
  overrides: readonly PermissionOverride[],
): void {
  if (actor.role === 'OWNER') {
    return;
  }

  const required = effectivePermissions(role, overrides);
  const missing = required.filter(
    (permission) => !actor.permissions.includes(permission),
  );
  if (missing.length > 0) {
    throw new DomainException(
      'PERMISSION_NOT_HELD',
      'The actor cannot assign a permission they do not have',
      403,
    );
  }
}
