import { DomainException } from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';

export function actorFrom(request: { actor?: RequestActor }): RequestActor {
  if (request.actor === undefined) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }
  return request.actor;
}

export function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return value?.trim() ?? '';
}

export function clientIp(request: {
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const address = request.ip ?? request.socket?.remoteAddress ?? '';
  return address.length > 0 ? address : 'unknown';
}
