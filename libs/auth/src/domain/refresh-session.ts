import { DomainException } from '@ciadelivery/shared';

export interface SessionToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface IssuedRefresh {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export type RefreshPresentation =
  | { kind: 'rotated'; userId: string; tokens: SessionToken[] }
  | { kind: 'reused'; tokens: SessionToken[] };

export function applyPresentedRefresh(
  tokens: readonly SessionToken[],
  presentedHash: string,
  now: Date,
  issued: IssuedRefresh,
): RefreshPresentation {
  const current = tokens.map((token) => ({ ...token }));
  const presented = current.find((token) => token.tokenHash === presentedHash);
  if (presented === undefined) {
    throw invalidRefresh();
  }

  if (presented.revokedAt !== null && presented.replacedById !== null) {
    for (const token of current) {
      if (token.familyId === presented.familyId && token.revokedAt === null) {
        token.revokedAt = now;
      }
    }
    return { kind: 'reused', tokens: current };
  }

  if (
    presented.revokedAt !== null ||
    presented.expiresAt.getTime() <= now.getTime()
  ) {
    throw invalidRefresh();
  }

  presented.revokedAt = now;
  presented.replacedById = issued.id;
  current.push({
    id: issued.id,
    userId: presented.userId,
    tokenHash: issued.tokenHash,
    familyId: presented.familyId,
    expiresAt: issued.expiresAt,
    revokedAt: null,
    replacedById: null,
    createdAt: issued.createdAt,
  });
  return { kind: 'rotated', userId: presented.userId, tokens: current };
}

function invalidRefresh(): DomainException {
  return new DomainException(
    'INVALID_REFRESH',
    'The refresh token is invalid',
    401,
  );
}
