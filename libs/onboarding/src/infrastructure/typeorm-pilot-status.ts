import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { PilotStatusReader, PilotTenantStatus } from '../domain/pilot-status';
import { OnboardingCode, isOnboardingCode } from '../domain/steps';

interface TenantRow {
  tenant_id: string;
  name: string;
  slug: string;
  published: number | boolean | string | null;
}

interface StepRow {
  tenant_id: string;
  code: string;
}

interface CountRow {
  tenant_id: string;
  total: number | string;
}

@Injectable()
export class TypeOrmPilotStatus implements PilotStatusReader {
  constructor(private readonly database: DatabaseReady) {}

  async list(since: Date): Promise<PilotTenantStatus[]> {
    const manager = (await this.database.ensure()).manager;
    const [tenants, steps, orders, failures] = await Promise.all([
      manager.query(
        `SELECT t.id AS tenant_id, t.name, t.slug, s.published
         FROM tenants t
         LEFT JOIN stores s ON s.tenant_id = t.id
         ORDER BY t.created_at ASC`,
      ) as Promise<TenantRow[]>,
      manager.query(
        `SELECT tenant_id, code
         FROM onboarding_steps
         WHERE status = 'PENDING'
         ORDER BY tenant_id, code`,
      ) as Promise<StepRow[]>,
      manager.query(
        `SELECT tenant_id, COUNT(*) AS total
         FROM orders
         WHERE source = 'STOREFRONT' AND created_at >= ?
         GROUP BY tenant_id`,
        [since],
      ) as Promise<CountRow[]>,
      manager.query(
        `SELECT tenant_id, COUNT(*) AS total
         FROM whatsapp_messages
         WHERE status = 'FAILED'
         GROUP BY tenant_id`,
      ) as Promise<CountRow[]>,
    ]);

    const pendingByTenant = new Map<string, OnboardingCode[]>();
    for (const step of steps) {
      if (!isOnboardingCode(step.code)) {
        continue;
      }
      const pending = pendingByTenant.get(step.tenant_id) ?? [];
      pending.push(step.code);
      pendingByTenant.set(step.tenant_id, pending);
    }
    const orderCount = countsByTenant(orders);
    const failureCount = countsByTenant(failures);

    return tenants.map((tenant) => ({
      tenantId: tenant.tenant_id,
      name: tenant.name,
      slug: tenant.slug,
      published:
        tenant.published === true ||
        tenant.published === 1 ||
        tenant.published === '1',
      pendingSteps: pendingByTenant.get(tenant.tenant_id) ?? [],
      storefrontOrdersLast7Days: orderCount.get(tenant.tenant_id) ?? 0,
      failedWhatsAppMessages: failureCount.get(tenant.tenant_id) ?? 0,
    }));
  }
}

function countsByTenant(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.tenant_id, Number(row.total)]));
}
