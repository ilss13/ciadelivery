import { DatabaseReady, DomainException } from '@ciadelivery/shared';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import {
  AuthSessions,
  LoginAttempt,
  PasswordResetToken,
} from '../domain/auth-sessions';
import {
  IssuedRefresh,
  SessionToken,
  applyPresentedRefresh,
} from '../domain/refresh-session';
import { LoginAttemptEntity } from './login-attempt.entity';
import { PasswordResetTokenEntity } from './password-reset.entity';
import { RefreshTokenEntity } from './refresh-token.entity';

@Injectable()
export class TypeOrmAuthSessions implements AuthSessions {
  constructor(private readonly database: DatabaseReady) {}

  async insertRefresh(token: SessionToken): Promise<void> {
    const manager = await this.manager();
    await manager.insert(RefreshTokenEntity, token);
  }

  async presentRefresh(
    presentedHash: string,
    issued: IssuedRefresh,
    now: Date,
    tx: TransactionContext,
  ): Promise<{ kind: 'rotated'; userId: string } | { kind: 'reused' }> {
    const manager = managerFrom(tx);
    const row = await manager
      .createQueryBuilder(RefreshTokenEntity, 'token')
      .setLock('pessimistic_write')
      .where('token.tokenHash = :hash', { hash: presentedHash })
      .getOne();
    if (row === null) {
      throw invalidRefreshRow();
    }

    const family = await manager
      .createQueryBuilder(RefreshTokenEntity, 'token')
      .setLock('pessimistic_write')
      .where('token.familyId = :familyId', { familyId: row.familyId })
      .getMany();
    const result = applyPresentedRefresh(
      family.map(toSessionToken),
      presentedHash,
      now,
      issued,
    );
    await manager.save(
      RefreshTokenEntity,
      result.tokens.map((token) => token),
    );
    if (result.kind === 'reused') {
      return { kind: 'reused' };
    }
    return { kind: 'rotated', userId: result.userId };
  }

  async revokeRefreshByHash(tokenHash: string, now: Date): Promise<void> {
    const manager = await this.manager();
    await manager.update(
      RefreshTokenEntity,
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: now },
    );
  }

  async revokeRefreshForUser(
    userId: string,
    now: Date,
    tx: TransactionContext,
  ): Promise<void> {
    await managerFrom(tx).update(
      RefreshTokenEntity,
      { userId, revokedAt: IsNull() },
      { revokedAt: now },
    );
  }

  async countRecentFailures(email: string, since: Date): Promise<number> {
    const manager = await this.manager();
    return manager
      .createQueryBuilder(LoginAttemptEntity, 'attempt')
      .where('attempt.email = :email', { email })
      .andWhere('attempt.succeeded = 0')
      .andWhere('attempt.createdAt > :since', { since })
      .getCount();
  }

  async insertLoginAttempt(attempt: LoginAttempt): Promise<void> {
    const manager = await this.manager();
    await manager.insert(LoginAttemptEntity, attempt);
  }

  async insertPasswordReset(token: PasswordResetToken): Promise<void> {
    const manager = await this.manager();
    await manager.insert(PasswordResetTokenEntity, { ...token, usedAt: null });
  }

  async consumePasswordReset(
    tokenHash: string,
    now: Date,
    tx: TransactionContext,
  ): Promise<string | null> {
    const manager = managerFrom(tx);
    const row = await manager
      .createQueryBuilder(PasswordResetTokenEntity, 'reset')
      .setLock('pessimistic_write')
      .where('reset.tokenHash = :tokenHash', { tokenHash })
      .getOne();
    if (
      row === null ||
      row.usedAt !== null ||
      row.expiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    await manager.update(PasswordResetTokenEntity, row.id, { usedAt: now });
    return row.userId;
  }

  private async manager(): Promise<EntityManager> {
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function managerFrom(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function toSessionToken(row: RefreshTokenEntity): SessionToken {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    familyId: row.familyId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    replacedById: row.replacedById,
    createdAt: row.createdAt,
  };
}

function invalidRefreshRow(): DomainException {
  return new DomainException(
    'INVALID_REFRESH',
    'The refresh token is invalid',
    401,
  );
}
