import { NodeEnv } from '@ciadelivery/shared';
import { REFRESH_COOKIE_PATH, REFRESH_TTL_MS } from '../domain/auth-policy';

export interface RefreshCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

export function refreshCookieOptions(nodeEnv: NodeEnv): RefreshCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv !== 'local',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_MS,
  };
}

export function readCookie(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const source = Array.isArray(header) ? header.join(';') : header;
  if (source === undefined || source.length === 0) {
    return undefined;
  }

  for (const part of source.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return undefined;
}
