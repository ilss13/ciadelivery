import { randomUUID } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { PasswordHasher } from '../domain/password-hasher';
import { assertStrongPassword } from '../domain/password-policy';
import {
  Permission,
  PermissionOverride,
  Role,
  TenantRole,
  assertAssignablePermissions,
  effectivePermissions,
  isPermission,
  isTenantRole,
} from '../domain/permissions';
import {
  RequestActor,
  UserAccount,
  UserProfile,
  UserStatus,
  normalizeEmail,
  toProfile,
} from '../domain/user';
import { assertLastOwnerRemains } from '../domain/last-owner';
import { UserChanges } from '../domain/user-changes';
import { Users } from '../domain/users.port';

export interface UserPage {
  items: UserProfile[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateTenantUserCommand {
  actor: RequestActor;
  name: string;
  email: string;
  password: string;
  role: TenantRole;
  permissionOverrides?: PermissionOverride[];
}

export interface UpdateTenantUserCommand {
  actor: RequestActor;
  userId: string;
  name?: string;
  role?: TenantRole;
  status?: UserStatus;
  password?: string;
  permissionOverrides?: PermissionOverride[];
}

export interface CreateTenantOwnerCommand {
  actor: { userId: string; role: string };
  tenantId: string;
  storeId: string;
  name: string;
  email: string;
  password: string;
}

export class CreateTenantUser {
  constructor(
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
    private readonly changes: UserChanges,
  ) {}

  async execute(command: CreateTenantUserCommand): Promise<UserProfile> {
    const scope = requireTenantScope(command.actor);
    const role = requireTenantRole(command.role);
    const overrides = command.permissionOverrides ?? [];
    assertOverrides(overrides);
    assertAssignablePermissions(command.actor, role, overrides);
    assertStrongPassword(command.password);
    const now = new Date();
    const user = account({
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name: command.name,
      email: command.email,
      passwordHash: await this.hasher.hash(command.password),
      role,
      status: 'ACTIVE',
      now,
    });
    await this.unitOfWork.run(async (tx) => {
      await this.users.insert(user, overrides, tx);
      await this.changes.record(
        {
          tenantId: scope.tenantId,
          actor: command.actor,
          action: 'user.created',
          userId: user.id,
          before: null,
          after: userAudit(user, overrides, false),
        },
        tx,
      );
    });
    return toProfile(user, effectivePermissions(role, overrides));
  }
}

export class UpdateTenantUser {
  constructor(
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
    private readonly changes: UserChanges,
  ) {}

  async execute(command: UpdateTenantUserCommand): Promise<UserProfile> {
    const scope = requireTenantScope(command.actor);
    const current = await this.users.findByIdInTenant(
      command.userId,
      scope.tenantId,
    );
    if (current === null) {
      throw userNotFound();
    }

    const role =
      command.role === undefined ? current.role : requireTenantRole(command.role);
    const existingOverrides = await this.users.listOverrides(current.id);
    const overrides = command.permissionOverrides ?? existingOverrides;
    assertOverrides(overrides);
    assertAssignablePermissions(command.actor, role, overrides);
    const passwordHash =
      command.password === undefined
        ? current.passwordHash
        : await hashPassword(this.hasher, command.password);
    const now = new Date();
    const updated: UserAccount = {
      ...current,
      name: command.name === undefined ? current.name : command.name.trim(),
      role,
      status: command.status ?? current.status,
      passwordHash,
      updatedAt: now,
    };
    const passwordChanged = command.password !== undefined;
    await this.unitOfWork.run(async (tx) => {
      assertLastOwnerRemains({
        currentRole: current.role,
        currentStatus: current.status,
        nextStatus: updated.status,
        activeOwnerCount: await this.users.countActiveOwners(
          scope.tenantId,
          tx,
        ),
      });
      await this.users.update(
        updated,
        command.permissionOverrides === undefined ? null : overrides,
        tx,
      );
      await this.changes.record(
        {
          tenantId: scope.tenantId,
          actor: command.actor,
          action: 'user.updated',
          userId: updated.id,
          before: userAudit(current, existingOverrides, false),
          after: userAudit(updated, overrides, passwordChanged),
        },
        tx,
      );
    });
    return toProfile(updated, effectivePermissions(role, overrides));
  }
}

export class GetTenantUser {
  constructor(private readonly users: Users) {}

  async execute(actor: RequestActor, userId: string): Promise<UserProfile> {
    const scope = requireTenantScope(actor);
    const user = await this.users.findByIdInTenant(userId, scope.tenantId);
    if (user === null) {
      throw userNotFound();
    }

    const overrides = await this.users.listOverrides(user.id);
    return toProfile(user, effectivePermissions(user.role, overrides));
  }
}

export class ListTenantUsers {
  constructor(private readonly users: Users) {}

  async execute(
    actor: RequestActor,
    page: number,
    pageSize: number,
  ): Promise<UserPage> {
    const scope = requireTenantScope(actor);
    const listed = await this.users.listByTenant(
      scope.tenantId,
      page,
      pageSize,
    );
    const overrides = await this.users.listOverridesForUsers(
      listed.items.map((user) => user.id),
    );
    return {
      items: listed.items.map((user) =>
        toProfile(user, effectivePermissions(user.role, overrides.get(user.id) ?? [])),
      ),
      page,
      pageSize,
      total: listed.total,
      totalPages: listed.total === 0 ? 0 : Math.ceil(listed.total / pageSize),
    };
  }
}

export class CreateTenantOwner {
  constructor(
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly unitOfWork: UnitOfWork,
    private readonly changes: UserChanges,
  ) {}

  async execute(command: CreateTenantOwnerCommand): Promise<UserProfile> {
    assertStrongPassword(command.password);
    const now = new Date();
    const user = account({
      tenantId: command.tenantId,
      storeId: command.storeId,
      name: command.name,
      email: command.email,
      passwordHash: await this.hasher.hash(command.password),
      role: 'OWNER',
      status: 'ACTIVE',
      now,
    });
    await this.unitOfWork.run(async (tx) => {
      if (await this.users.existsOwner(command.tenantId, tx)) {
        throw ownerAlreadyExists();
      }
      await this.users.insert(user, [], tx);
      await this.changes.record(
        {
          tenantId: command.tenantId,
          actor: command.actor,
          action: 'user.created',
          userId: user.id,
          before: null,
          after: userAudit(user, [], false),
        },
        tx,
      );
    });
    return toProfile(user, effectivePermissions('OWNER', []));
  }
}

function account(input: {
  tenantId: string;
  storeId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  now: Date;
}): UserAccount {
  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    storeId: input.storeId,
    name: input.name.trim(),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    role: input.role,
    status: input.status,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

async function hashPassword(
  hasher: PasswordHasher,
  password: string,
): Promise<string> {
  assertStrongPassword(password);
  return hasher.hash(password);
}

function requireTenantScope(actor: RequestActor): {
  tenantId: string;
  storeId: string;
} {
  if (actor.tenantId === null || actor.storeId === null) {
    throw new DomainException(
      'FORBIDDEN',
      'The user cannot manage tenant users',
      403,
    );
  }

  return { tenantId: actor.tenantId, storeId: actor.storeId };
}

function requireTenantRole(role: string): TenantRole {
  if (!isTenantRole(role)) {
    throw new DomainException(
      'ROLE_NOT_ALLOWED',
      'The role cannot be assigned',
      400,
    );
  }

  return role;
}

function assertOverrides(overrides: readonly PermissionOverride[]): void {
  const seen = new Set<Permission>();
  for (const override of overrides) {
    if (!isPermission(override.permission)) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
      );
    }
    if (seen.has(override.permission)) {
      throw new DomainException(
        'PERMISSION_OVERRIDE_DUPLICATE',
        'The permission override is duplicated',
        400,
      );
    }
    seen.add(override.permission);
  }
}

function userAudit(
  user: UserAccount,
  overrides: readonly PermissionOverride[],
  passwordChanged: boolean,
): Record<string, unknown> {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissionOverrides: overrides.map((override) => ({
      permission: override.permission,
      granted: override.granted,
    })),
    hashUpdated: passwordChanged,
  };
}

function userNotFound(): DomainException {
  return new DomainException('USER_NOT_FOUND', 'The user was not found', 404);
}

function ownerAlreadyExists(): DomainException {
  return new DomainException(
    'OWNER_ALREADY_EXISTS',
    'The tenant already has an owner',
    409,
  );
}
