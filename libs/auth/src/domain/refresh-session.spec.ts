import { applyPresentedRefresh, SessionToken } from './refresh-session';

function token(overrides: Partial<SessionToken> = {}): SessionToken {
  return {
    id: 'token-a',
    userId: 'user-1',
    tokenHash: 'hash-a',
    familyId: 'family-1',
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    revokedAt: null,
    replacedById: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const now = new Date('2026-01-01T00:00:00.000Z');

describe('refresh rotation', () => {
  it('revokes the presented token and issues another in the same family', () => {
    const result = applyPresentedRefresh([token()], 'hash-a', now, {
      id: 'token-b',
      tokenHash: 'hash-b',
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      createdAt: now,
    });

    expect(result.kind).toBe('rotated');
    if (result.kind !== 'rotated') {
      return;
    }
    expect(result.userId).toBe('user-1');
    expect(result.tokens[0]).toMatchObject({
      revokedAt: now,
      replacedById: 'token-b',
    });
    expect(result.tokens[1]).toMatchObject({
      id: 'token-b',
      familyId: 'family-1',
      revokedAt: null,
      replacedById: null,
    });
  });

  it('revokes the family when a rotated token is presented again', () => {
    const rotated = applyPresentedRefresh([token()], 'hash-a', now, {
      id: 'token-b',
      tokenHash: 'hash-b',
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      createdAt: now,
    });
    const reused = applyPresentedRefresh(rotated.tokens, 'hash-a', now, {
      id: 'token-c',
      tokenHash: 'hash-c',
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      createdAt: now,
    });

    expect(reused.kind).toBe('reused');
    expect(reused.tokens.every((item) => item.revokedAt !== null)).toBe(true);
    expect(() =>
      applyPresentedRefresh(reused.tokens, 'hash-b', now, {
        id: 'token-d',
        tokenHash: 'hash-d',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        createdAt: now,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REFRESH', statusCode: 401 }));
  });

  it('rejects an expired token and a logged-out token without revoking the family', () => {
    const active = token({ id: 'token-b', tokenHash: 'hash-b' });
    const expired = token({
      expiresAt: new Date('2025-12-31T00:00:00.000Z'),
    });
    expect(() =>
      applyPresentedRefresh([expired, active], 'hash-a', now, {
        id: 'token-c',
        tokenHash: 'hash-c',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        createdAt: now,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REFRESH' }));

    const loggedOut = token({ revokedAt: now, replacedById: null });
    expect(() =>
      applyPresentedRefresh([loggedOut, active], 'hash-a', now, {
        id: 'token-c',
        tokenHash: 'hash-c',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        createdAt: now,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REFRESH' }));
  });

  it('rejects an unknown token', () => {
    expect(() =>
      applyPresentedRefresh([token()], 'missing', now, {
        id: 'token-b',
        tokenHash: 'hash-b',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        createdAt: now,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REFRESH' }));
  });
});
