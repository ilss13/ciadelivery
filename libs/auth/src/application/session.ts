import { randomBytes, randomUUID } from 'node:crypto';
import {
  actorTypeOf,
  AuditLogs,
  maskEmail,
  recordAudit,
} from '@ciadelivery/audit';
import { DomainException } from '@ciadelivery/shared';
import {
  TenantRepository,
  TransactionContext,
  UnitOfWork,
} from '@ciadelivery/tenancy/domain';
import {
  PasswordHasher,
  UserAccount,
  Users,
  effectivePermissions,
  normalizeEmail,
} from '@ciadelivery/users';
import {
  LOGIN_LOCK_LIMIT,
  LOGIN_LOCK_WINDOW_MS,
  REFRESH_TTL_MS,
} from '../domain/auth-policy';
import { AccessClaims, signAccessToken } from '../domain/access-token';
import { AuthSessions, LoginRateLimit } from '../domain/auth-sessions';
import { SessionToken } from '../domain/refresh-session';
import { hashToken } from '../domain/token-hash';

export interface AuthenticatedSession {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCommand {
  email: string;
  password: string;
  ip: string;
}

export class Login {
  constructor(
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly sessions: AuthSessions,
    private readonly rateLimit: LoginRateLimit,
    private readonly tenants: TenantRepository,
    private readonly accessSecret: string,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
  ) {}

  async execute(command: LoginCommand): Promise<AuthenticatedSession> {
    await this.rateLimit.consume(command.ip);
    const email = normalizeEmail(command.email);
    const now = new Date();
    const since = new Date(now.getTime() - LOGIN_LOCK_WINDOW_MS);
    const recentFailures = await this.sessions.countRecentFailures(email, since);
    if (recentFailures >= LOGIN_LOCK_LIMIT) {
      throw loginLocked();
    }

    const user = await this.users.findByEmail(email);
    const passwordMatches =
      user !== null &&
      (await this.hasher.verify(command.password, user.passwordHash));
    if (user === null || !passwordMatches) {
      await this.unitOfWork.run(async (tx) => {
        await this.sessions.insertLoginAttempt(
          {
            id: randomUUID(),
            email,
            ip: command.ip,
            succeeded: false,
            createdAt: now,
          },
          tx,
        );
        await this.writeLoginAudit(user, email, 'auth.login_failed', tx);
      });
      if (recentFailures + 1 >= LOGIN_LOCK_LIMIT) {
        throw loginLocked();
      }
      throw invalidCredentials();
    }

    if (user.status === 'DISABLED') {
      await this.unitOfWork.run((tx) =>
        this.writeLoginAudit(user, email, 'auth.login_failed', tx),
      );
      throw userDisabled();
    }
    try {
      await assertTenantCanAuthenticate(this.tenants, user);
    } catch (error) {
      await this.unitOfWork.run((tx) =>
        this.writeLoginAudit(user, email, 'auth.login_failed', tx),
      );
      throw error;
    }

    const refresh = issueRefresh(user.id, now);
    await this.unitOfWork.run(async (tx) => {
      await this.sessions.insertLoginAttempt(
        {
          id: randomUUID(),
          email,
          ip: command.ip,
          succeeded: true,
          createdAt: now,
        },
        tx,
      );
      await this.sessions.insertRefresh(refresh.record, tx);
      await this.writeLoginAudit(user, email, 'auth.login_succeeded', tx);
    });
    return {
      accessToken: await accessTokenFor(this.users, user, this.accessSecret, now),
      refreshToken: refresh.secret,
    };
  }

  private writeLoginAudit(
    user: UserAccount | null,
    email: string,
    action: 'auth.login_succeeded' | 'auth.login_failed',
    tx: TransactionContext,
  ): Promise<void> {
    return recordAudit(this.audit, tx, {
      tenantId: user?.tenantId ?? null,
      actorId: user?.id ?? null,
      actorType: user === null ? 'SYSTEM' : actorTypeOf(user.role),
      action,
      entityType: 'user',
      entityId: user?.id ?? 'unknown',
      before: null,
      changes: { email: maskEmail(email) },
    });
  }
}

export class RefreshAccess {
  constructor(
    private readonly users: Users,
    private readonly sessions: AuthSessions,
    private readonly tenants: TenantRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly accessSecret: string,
  ) {}

  async execute(refreshToken: string | undefined): Promise<AuthenticatedSession> {
    if (refreshToken === undefined || refreshToken.trim().length === 0) {
      throw invalidRefresh();
    }

    const now = new Date();
    const refresh = issueRefresh('', now);
    const outcome = await this.unitOfWork.run(async (tx) => {
      const presented = await this.sessions.presentRefresh(
        hashToken(refreshToken),
        {
          id: refresh.record.id,
          tokenHash: refresh.record.tokenHash,
          expiresAt: refresh.record.expiresAt,
          createdAt: refresh.record.createdAt,
        },
        now,
        tx,
      );
      if (presented.kind === 'reused') {
        return { kind: 'reused' as const };
      }

      const user = await this.users.findById(presented.userId, tx);
      if (user === null) {
        throw invalidRefresh();
      }
      if (user.status === 'DISABLED') {
        throw userDisabled();
      }
      await assertTenantCanAuthenticate(this.tenants, user);
      return { kind: 'rotated' as const, user };
    });

    if (outcome.kind === 'reused') {
      throw new DomainException(
        'REFRESH_REUSED',
        'The refresh token was already used',
        401,
      );
    }

    return {
      accessToken: await accessTokenFor(
        this.users,
        outcome.user,
        this.accessSecret,
        now,
      ),
      refreshToken: refresh.secret,
    };
  }
}

export class Logout {
  constructor(private readonly sessions: AuthSessions) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken.trim().length === 0) {
      return;
    }

    await this.sessions.revokeRefreshByHash(hashToken(refreshToken), new Date());
  }
}

export function issueRefresh(
  userId: string,
  now: Date,
  familyId = randomUUID(),
): { secret: string; record: SessionToken } {
  const secret = randomBytes(32).toString('base64url');
  return {
    secret,
    record: {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(secret),
      familyId,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      revokedAt: null,
      replacedById: null,
      createdAt: now,
    },
  };
}

async function accessTokenFor(
  users: Users,
  user: UserAccount,
  secret: string,
  now: Date,
): Promise<string> {
  const overrides = await users.listOverrides(user.id);
  const claims: AccessClaims = {
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId,
    permissions: effectivePermissions(user.role, overrides),
  };
  return signAccessToken(claims, secret, now);
}

async function assertTenantCanAuthenticate(
  tenants: TenantRepository,
  user: UserAccount,
): Promise<void> {
  if (user.role === 'SUPER_ADMIN') {
    return;
  }
  if (user.tenantId === null) {
    throw invalidCredentials();
  }

  const tenant = await tenants.findById(user.tenantId);
  if (tenant === null) {
    throw invalidCredentials();
  }
  if (tenant.status === 'SUSPENDED') {
    throw new DomainException(
      'TENANT_SUSPENDED',
      'The tenant is suspended',
      403,
    );
  }
}

function invalidCredentials(): DomainException {
  return new DomainException(
    'INVALID_CREDENTIALS',
    'The email or password is incorrect',
    401,
  );
}

function invalidRefresh(): DomainException {
  return new DomainException(
    'INVALID_REFRESH',
    'The refresh token is invalid',
    401,
  );
}

function loginLocked(): DomainException {
  return new DomainException(
    'LOGIN_LOCKED',
    'The login is temporarily locked',
    429,
  );
}

function userDisabled(): DomainException {
  return new DomainException('USER_DISABLED', 'The user is disabled', 403);
}
