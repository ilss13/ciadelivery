import { APP_CONFIG, AppConfig, DomainException } from '@ciadelivery/shared';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  TENANT_REPOSITORY,
  Tenant,
  TenantRepository,
} from '@ciadelivery/tenancy';
import {
  RequestActor,
  Users,
  USERS,
  effectivePermissions,
} from '@ciadelivery/users';
import { readAccessToken } from '../domain/access-token';

@Injectable()
export class AuthenticateGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(USERS) private readonly users: Users,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      path?: string;
      url?: string;
      actor?: RequestActor;
      tenant?: Tenant;
    }>();
    if (isMetricsPath(request.path ?? request.url)) {
      return true;
    }
    const header = readHeader(request.headers['authorization']);
    if (header === undefined) {
      return true;
    }

    const token = readBearer(header);
    const claims = readAccessToken(token, this.config.jwtAccessSecret, new Date());
    const user = await this.users.findById(claims.sub);
    if (user === null) {
      throw new DomainException(
        'INVALID_ACCESS_TOKEN',
        'The access token is invalid',
        401,
      );
    }
    if (user.status === 'DISABLED') {
      throw new DomainException('USER_DISABLED', 'The user is disabled', 403);
    }
    if (user.role !== 'SUPER_ADMIN') {
      if (user.tenantId === null) {
        throw new DomainException(
          'INVALID_ACCESS_TOKEN',
          'The access token is invalid',
          401,
        );
      }
      const tenant = await this.tenants.findById(user.tenantId);
      if (tenant === null) {
        throw new DomainException(
          'INVALID_ACCESS_TOKEN',
          'The access token is invalid',
          401,
        );
      }
      if (tenant.status === 'SUSPENDED') {
        throw new DomainException(
          'TENANT_SUSPENDED',
          'The tenant is suspended',
          403,
        );
      }
      request.tenant = tenant;
    }

    const overrides = await this.users.listOverrides(user.id);
    request.actor = {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      storeId: user.storeId,
      permissions: effectivePermissions(user.role, overrides),
    };
    return true;
  }
}

function isMetricsPath(path: string | undefined): boolean {
  if (path === undefined) {
    return false;
  }
  const pathname = path.split('?')[0] ?? path;
  return pathname === '/metrics';
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readBearer(header: string): string {
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  if (token === undefined || token.length === 0) {
    throw new DomainException(
      'INVALID_ACCESS_TOKEN',
      'The access token is invalid',
      401,
    );
  }
  return token;
}
