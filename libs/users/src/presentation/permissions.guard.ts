import { DomainException } from '@ciadelivery/shared';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../domain/permissions';
import { RequestActor } from '../domain/user';

export const REQUIRE_PERMISSIONS = 'require_permissions';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      readonly Permission[] | undefined
    >(REQUIRE_PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ actor?: RequestActor }>();
    if (request.actor === undefined) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Authentication is required',
        401,
      );
    }

    const missing = required.filter(
      (permission) => !request.actor?.permissions.includes(permission),
    );
    if (missing.length > 0) {
      throw new DomainException(
        'FORBIDDEN',
        'The permission is required',
        403,
      );
    }

    return true;
  }
}
