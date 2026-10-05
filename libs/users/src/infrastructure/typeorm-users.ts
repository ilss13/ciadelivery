import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { PermissionOverride } from '../domain/permissions';
import { UserAccount } from '../domain/user';
import { Users } from '../domain/users.port';
import { isMysqlDuplicate, mysqlMessage } from './mysql-error';
import { UserPermissionOverrideEntity } from './user-permission-override.entity';
import { UserEntity } from './user.entity';

@Injectable()
export class TypeOrmUsers implements Users {
  constructor(private readonly database: DatabaseReady) {}

  async insert(
    user: UserAccount,
    overrides: readonly PermissionOverride[],
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerFrom(tx);
    try {
      await manager.insert(UserEntity, user);
    } catch (error) {
      if (isMysqlDuplicate(error)) {
        throw duplicateUser(error, user.role);
      }
      throw error;
    }

    await insertOverrides(manager, user.id, overrides);
  }

  async update(
    user: UserAccount,
    overrides: readonly PermissionOverride[] | null,
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerFrom(tx);
    await manager.update(
      UserEntity,
      { id: user.id, tenantId: user.tenantId },
      {
        name: user.name,
        role: user.role,
        status: user.status,
        passwordHash: user.passwordHash,
        updatedAt: user.updatedAt,
      },
    );
    if (overrides !== null) {
      await manager.delete(UserPermissionOverrideEntity, { userId: user.id });
      await insertOverrides(manager, user.id, overrides);
    }
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    updatedAt: Date,
    tx: TransactionContext,
  ): Promise<void> {
    const manager = managerFrom(tx);
    const current = await manager.findOne(UserEntity, {
      where: { id: userId },
    });
    if (current === null) {
      throw new DomainException(
        'USER_NOT_FOUND',
        'The user was not found',
        404,
      );
    }
    await manager.update(
      UserEntity,
      { id: current.id, tenantId: current.tenantId },
      { passwordHash, updatedAt },
    );
  }

  async findById(
    id: string,
    tx?: TransactionContext,
  ): Promise<UserAccount | null> {
    const manager = await this.manager(tx);
    const row = await manager.findOne(UserEntity, { where: { id } });
    return row === null ? null : toAccount(row);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const manager = await this.manager();
    const row = await manager.findOne(UserEntity, { where: { email } });
    return row === null ? null : toAccount(row);
  }

  async findByIdInTenant(
    id: string,
    tenantId: string,
  ): Promise<UserAccount | null> {
    const manager = await this.manager();
    const row = await manager.findOne(UserEntity, { where: { id, tenantId } });
    return row === null ? null : toAccount(row);
  }

  async listByTenant(
    tenantId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: UserAccount[]; total: number }> {
    const manager = await this.manager();
    const [rows, total] = await manager.findAndCount(UserEntity, {
      where: { tenantId },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items: rows.map(toAccount), total };
  }

  async listOverrides(userId: string): Promise<PermissionOverride[]> {
    const grouped = await this.listOverridesForUsers([userId]);
    return grouped.get(userId) ?? [];
  }

  async listOverridesForUsers(
    userIds: readonly string[],
  ): Promise<Map<string, PermissionOverride[]>> {
    const grouped = new Map<string, PermissionOverride[]>();
    if (userIds.length === 0) {
      return grouped;
    }

    const manager = await this.manager();
    const rows = await manager.find(UserPermissionOverrideEntity, {
      where: { userId: In([...userIds]) },
    });
    for (const row of rows) {
      const current = grouped.get(row.userId) ?? [];
      current.push({ permission: row.permission, granted: row.granted });
      grouped.set(row.userId, current);
    }
    return grouped;
  }

  async existsOwner(
    tenantId: string,
    tx: TransactionContext,
  ): Promise<boolean> {
    const manager = managerFrom(tx);
    const count = await manager.count(UserEntity, {
      where: { tenantId, role: 'OWNER' },
    });
    return count > 0;
  }

  async countActiveOwners(
    tenantId: string,
    tx: TransactionContext,
  ): Promise<number> {
    const manager = managerFrom(tx);
    return manager.count(UserEntity, {
      where: { tenantId, role: 'OWNER', status: 'ACTIVE' },
    });
  }

  private async manager(tx?: TransactionContext): Promise<EntityManager> {
    if (tx !== undefined) {
      return managerFrom(tx);
    }

    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function managerFrom(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

async function insertOverrides(
  manager: EntityManager,
  userId: string,
  overrides: readonly PermissionOverride[],
): Promise<void> {
  if (overrides.length === 0) {
    return;
  }

  await manager.insert(
    UserPermissionOverrideEntity,
    overrides.map((override) => ({
      userId,
      permission: override.permission,
      granted: override.granted,
    })),
  );
}

function toAccount(row: UserEntity): UserAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function duplicateUser(
  error: unknown,
  role: UserAccount['role'],
): DomainException {
  const message = mysqlMessage(error);
  if (message.includes('uq_users_email')) {
    return emailTaken();
  }
  if (message.includes('uq_users_owner_tenant') || role === 'OWNER') {
    return new DomainException(
      'OWNER_ALREADY_EXISTS',
      'The tenant already has an owner',
      409,
    );
  }

  return emailTaken();
}

function emailTaken(): DomainException {
  return new DomainException('EMAIL_TAKEN', 'The email is already in use', 409);
}
