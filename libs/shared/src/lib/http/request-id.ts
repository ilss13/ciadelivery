import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRequestId(
  headerValue: string | string[] | undefined,
): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (raw !== undefined && REQUEST_ID_PATTERN.test(raw)) {
    return raw;
  }

  return randomUUID();
}

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request.headers['x-request-id']);
  response.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, () => {
    next();
  });
}
