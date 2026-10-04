import { APP_CONFIG, AppConfig, DomainException } from '@ciadelivery/shared';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ResolveTenant } from '../application/resolve-tenant';
import { enterTenantContext } from '../domain/tenant-context';
import { readSingleHeader, selectRequestHost } from '../domain/request-host';
import { Tenant } from '../domain/tenant';

export interface RequestWithTenant {
  headers: Record<string, string | string[] | undefined>;
  tenant?: Tenant;
}

@Injectable()
export class PublicTenantGuard implements CanActivate {
  constructor(
    private readonly resolveTenant: ResolveTenant,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const host = selectRequestHost({
      nodeEnv: this.config.nodeEnv,
      hostHeader: readSingleHeader(request.headers['host']),
      tenantHostHeader: readSingleHeader(request.headers['x-tenant-host']),
    });
    const resolved = await this.resolveTenant.execute(
      host,
      this.config.platformDomain,
    );
    if (resolved.kind === 'platform') {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    request.tenant = resolved.tenant;
    enterTenantContext(resolved.tenant);
    return true;
  }
}
