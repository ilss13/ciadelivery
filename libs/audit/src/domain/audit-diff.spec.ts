import { fieldChanges, isAuditSecretKey, maskEmail, sanitizeAudit } from './audit-diff';

describe('audit diff', () => {
  it('masks an email and keeps the domain', () => {
    expect(maskEmail('ana@example.com')).toBe('a***@example.com');
  });

  it('keeps only the fields that changed, in cents', () => {
    expect(
      fieldChanges(
        { name: 'Pizza', priceCents: 3990, available: true },
        { name: 'Pizza', priceCents: 4500, available: true },
      ),
    ).toEqual({
      before: { priceCents: 3990 },
      changes: { priceCents: 4500 },
    });
  });

  it('drops password hashes and access tokens', () => {
    expect(isAuditSecretKey('password_hash')).toBe(true);
    expect(isAuditSecretKey('accessToken')).toBe(true);
    expect(isAuditSecretKey('encryptedCredentials')).toBe(true);
    expect(isAuditSecretKey('trackingToken')).toBe(true);
    const token = 'super-secret-token-value';
    const sanitized = sanitizeAudit({
      status: 'CONNECTED',
      phoneNumberId: '106540352242922',
      accessToken: token,
      password_hash: 'argon',
    });
    expect(JSON.stringify(sanitized)).not.toContain(token);
    expect(JSON.stringify(sanitized)).not.toContain('argon');
    expect(sanitized).toEqual({
      status: 'CONNECTED',
      phoneNumberId: '106540352242922',
      accessToken: '[redacted]',
      password_hash: '[redacted]',
    });
    expect(sanitizeAudit({ hashUpdated: false })).toEqual({
      hashUpdated: false,
    });
  });
});
