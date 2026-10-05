import { createHmac } from 'node:crypto';
import { constantTimeEqual, verifyMetaSignature } from './webhook-signature';

describe('webhook signature', () => {
  const secret = 'test-meta-app-secret';
  const body = Buffer.from('{"entry":[]}', 'utf8');

  it('accepts the Meta HMAC and rejects a different body', () => {
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyMetaSignature(body, signature, secret)).toBe(true);
    expect(
      verifyMetaSignature(Buffer.from('{"entry":[1]}', 'utf8'), signature, secret),
    ).toBe(false);
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, signature, '')).toBe(false);
  });

  it('compares unequal lengths without throwing', () => {
    expect(constantTimeEqual('a', 'ab')).toBe(false);
    expect(constantTimeEqual('same', 'same')).toBe(true);
  });
});
