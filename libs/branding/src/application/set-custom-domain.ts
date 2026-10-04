import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { TenantRepository, UpdateTenant } from '@ciadelivery/tenancy';
import { RequestActor } from '@ciadelivery/users';

export class SetCustomDomain {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly updateTenant: UpdateTenant,
    private readonly tenants: TenantRepository,
    private readonly platformDomain: string,
  ) {}

  async get(actor: RequestActor): Promise<{ customDomain: string | null }> {
    const tenant = await this.requireTenant(actor);
    return { customDomain: tenant.customDomain };
  }

  async set(
    actor: RequestActor,
    customDomain: string | null,
  ): Promise<{ customDomain: string | null }> {
    const tenant = await this.requireTenant(actor);
    const updated = await this.updateTenant.execute({
      id: tenant.id,
      customDomain,
      platformDomain: this.platformDomain,
    });
    this.logger.log(
      `Custom domain updated ${updated.tenant.id}`,
      'SetCustomDomain',
    );
    return { customDomain: updated.tenant.customDomain };
  }

  private async requireTenant(actor: RequestActor) {
    if (actor.tenantId === null) {
      throw new DomainException('FORBIDDEN', 'The permission is required', 403);
    }

    const tenant = await this.tenants.findById(actor.tenantId);
    if (tenant === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    return tenant;
  }
}
