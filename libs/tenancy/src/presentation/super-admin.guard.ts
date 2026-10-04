import { DomainException } from '@ciadelivery/shared';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      actor?: { role?: string };
    }>();
    if (request.actor === undefined) {
      throw new DomainException(
        'PLATFORM_UNAUTHORIZED',
        'Platform authentication is required',
        401,
      );
    }
    if (request.actor.role !== 'SUPER_ADMIN') {
      throw new DomainException(
        'FORBIDDEN',
        'The permission is required',
        403,
      );
    }

    return true;
  }
}
