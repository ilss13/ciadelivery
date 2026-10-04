export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED', 'TRIAL'] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planCode: string;
  customDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isTenantStatus(value: string): value is TenantStatus {
  return (TENANT_STATUSES as readonly string[]).includes(value);
}
