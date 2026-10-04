import { randomBytes, randomUUID } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import {
  PasswordHasher,
  UserProfile,
  Users,
  assertStrongPassword,
  effectivePermissions,
  normalizeEmail,
  toProfile,
} from '@ciadelivery/users';
import { RESET_TTL_MS } from '../domain/auth-policy';
import { AuthSessions } from '../domain/auth-sessions';
import { MailProvider } from '../domain/mail-provider';
import { hashToken } from '../domain/token-hash';

export class ForgotPassword {
  constructor(
    private readonly users: Users,
    private readonly sessions: AuthSessions,
    private readonly mail: MailProvider,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    if (user === null || user.status !== 'ACTIVE') {
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.sessions.insertPasswordReset({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      createdAt: now,
    });
    await this.mail.sendPasswordReset({ to: user.email, token });
  }
}

export class ResetPassword {
  constructor(
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly sessions: AuthSessions,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(token: string, password: string): Promise<void> {
    assertStrongPassword(password);
    const now = new Date();
    const passwordHash = await this.hasher.hash(password);
    await this.unitOfWork.run(async (tx) => {
      const userId = await this.sessions.consumePasswordReset(
        hashToken(token),
        now,
        tx,
      );
      if (userId === null) {
        throw new DomainException(
          'INVALID_RESET_TOKEN',
          'The password reset token is invalid',
          400,
        );
      }
      await this.users.updatePassword(userId, passwordHash, now, tx);
      await this.sessions.revokeRefreshForUser(userId, now, tx);
    });
  }
}

export class GetSession {
  constructor(private readonly users: Users) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Authentication is required',
        401,
      );
    }

    const overrides = await this.users.listOverrides(user.id);
    return toProfile(user, effectivePermissions(user.role, overrides));
  }
}
