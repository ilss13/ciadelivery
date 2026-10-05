import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function credentialsHint(secret: string): string {
  return secret.slice(-4);
}

export function encryptCredentials(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCredentials(payload: string, key: Buffer): string {
  const data = Buffer.from(payload, 'base64');
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

export function decodeCredentialsKey(value: string): Buffer | null {
  if (value.length === 0) {
    return null;
  }
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
