import { randomBytes } from 'node:crypto';
import {
  credentialsHint,
  decryptCredentials,
  encryptCredentials,
} from './credentials-cipher';

describe('credentials cipher', () => {
  const key = randomBytes(32);

  it('round-trips the token and exposes only the last four characters', () => {
    const token = 'super-secret-token-value';
    const encrypted = encryptCredentials(token, key);
    expect(encrypted).not.toContain(token);
    expect(decryptCredentials(encrypted, key)).toBe(token);
    expect(credentialsHint(token)).toBe('alue');
  });

  it('rejects a payload encrypted with another key', () => {
    const encrypted = encryptCredentials('token-value-1234', key);
    expect(() => decryptCredentials(encrypted, randomBytes(32))).toThrow();
  });
});
