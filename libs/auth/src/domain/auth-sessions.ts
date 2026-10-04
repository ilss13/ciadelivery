import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { IssuedRefresh, SessionToken } from './refresh-session';

export interface LoginAttempt {
  id: string;
  email: string;
  ip: string;
  succeeded: boolean;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthSessions {
  insertRefresh(token: SessionToken): Promise<void>;
  presentRefresh(
    presentedHash: string,
    issued: IssuedRefresh,
    now: Date,
    tx: TransactionContext,
  ): Promise<{ kind: 'rotated'; userId: string } | { kind: 'reused' }>;
  revokeRefreshByHash(tokenHash: string, now: Date): Promise<void>;
  revokeRefreshForUser(
    userId: string,
    now: Date,
    tx: TransactionContext,
  ): Promise<void>;
  countRecentFailures(email: string, since: Date): Promise<number>;
  insertLoginAttempt(attempt: LoginAttempt): Promise<void>;
  insertPasswordReset(token: PasswordResetToken): Promise<void>;
  consumePasswordReset(
    tokenHash: string,
    now: Date,
    tx: TransactionContext,
  ): Promise<string | null>;
}

export const AUTH_SESSIONS = Symbol('AUTH_SESSIONS');

export interface LoginRateLimit {
  consume(ip: string): Promise<void>;
}

export const LOGIN_RATE_LIMIT = Symbol('LOGIN_RATE_LIMIT');
