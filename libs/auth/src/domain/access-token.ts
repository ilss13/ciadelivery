import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { Permission, Role, isPermission, isRole } from '@ciadelivery/users';
import { ACCESS_TTL_SECONDS } from './auth-policy';

export interface AccessClaims {
  sub: string;
  role: Role;
  tenantId: string | null;
  storeId: string | null;
  permissions: Permission[];
}

const HEADER = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
).toString('base64url');

export function signAccessToken(
  claims: AccessClaims,
  secret: string,
  now: Date,
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: claims.sub,
      role: claims.role,
      tenantId: claims.tenantId,
      storeId: claims.storeId,
      permissions: claims.permissions,
      iat: issuedAt,
      exp: issuedAt + ACCESS_TTL_SECONDS,
    }),
  ).toString('base64url');
  const signingInput = `${HEADER}.${payload}`;
  return `${signingInput}.${sign(signingInput, secret)}`;
}

export function readAccessToken(
  token: string,
  secret: string,
  now: Date,
): AccessClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw invalidAccessToken();
  }

  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signaturePart = parts[2];
  if (
    headerPart === undefined ||
    payloadPart === undefined ||
    signaturePart === undefined
  ) {
    throw invalidAccessToken();
  }

  const expected = sign(`${headerPart}.${payloadPart}`, secret);
  const actual = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (
    actual.length !== expectedBuffer.length ||
    !timingSafeEqual(actual, expectedBuffer)
  ) {
    throw invalidAccessToken();
  }

  let payload: unknown;
  try {
    const header = JSON.parse(
      Buffer.from(headerPart, 'base64url').toString('utf8'),
    ) as { alg?: string };
    if (header.alg !== 'HS256') {
      throw invalidAccessToken();
    }
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch (error) {
    if (error instanceof DomainException) {
      throw error;
    }
    throw invalidAccessToken();
  }

  if (!isAccessPayload(payload)) {
    throw invalidAccessToken();
  }
  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    throw invalidAccessToken();
  }

  return {
    sub: payload.sub,
    role: payload.role,
    tenantId: payload.tenantId,
    storeId: payload.storeId,
    permissions: payload.permissions,
  };
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function invalidAccessToken(): DomainException {
  return new DomainException(
    'INVALID_ACCESS_TOKEN',
    'The access token is invalid',
    401,
  );
}

interface AccessPayload {
  sub: string;
  role: Role;
  tenantId: string | null;
  storeId: string | null;
  permissions: Permission[];
  exp: number;
}

function isAccessPayload(value: unknown): value is AccessPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload['sub'] === 'string' &&
    typeof payload['role'] === 'string' &&
    isRole(payload['role']) &&
    (typeof payload['tenantId'] === 'string' || payload['tenantId'] === null) &&
    (typeof payload['storeId'] === 'string' || payload['storeId'] === null) &&
    Array.isArray(payload['permissions']) &&
    payload['permissions'].every(
      (permission) => typeof permission === 'string' && isPermission(permission),
    ) &&
    typeof payload['exp'] === 'number'
  );
}
