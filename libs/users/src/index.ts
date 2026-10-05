export { UsersModule } from './users.module';
export {
  PermissionsGuard,
  RequirePermissions,
} from './presentation/permissions.guard';
export {
  CreateTenantOwner,
  CreateTenantUser,
  GetTenantUser,
  ListTenantUsers,
  UpdateTenantUser,
} from './application/tenant-users';
export { PASSWORD_HASHER } from './domain/password-hasher';
export type { PasswordHasher } from './domain/password-hasher';
export {
  PERMISSIONS,
  ROLES,
  TENANT_ROLES,
  assertAssignablePermissions,
  effectivePermissions,
  isPermission,
  isRole,
  isTenantRole,
} from './domain/permissions';
export type {
  Permission,
  PermissionOverride,
  Role,
  TenantRole,
} from './domain/permissions';
export { assertLastOwnerRemains } from './domain/last-owner';
export { assertStrongPassword } from './domain/password-policy';
export { USER_CHANGES } from './domain/user-changes';
export type { UserChange, UserChanges } from './domain/user-changes';
export { USERS } from './domain/users.port';
export type { Users } from './domain/users.port';
export { USER_STATUSES, normalizeEmail, toProfile } from './domain/user';
export type {
  RequestActor,
  UserAccount,
  UserProfile,
  UserStatus,
} from './domain/user';
