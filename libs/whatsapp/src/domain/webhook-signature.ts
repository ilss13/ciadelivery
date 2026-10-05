import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function constantTimeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left, 'utf8').digest();
  const rightHash = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (
    signatureHeader === undefined ||
    signatureHeader.length === 0 ||
    appSecret.length === 0
  ) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return constantTimeEqual(signatureHeader, expected);
}
