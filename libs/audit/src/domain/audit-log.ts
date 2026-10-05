import { TransactionContext } from '@ciadelivery/tenancy/domain';

export const ACTOR_TYPES = ['USER', 'SYSTEM', 'SUPER_ADMIN'] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export interface AuditDraft {
  tenantId: string | null;
  actorId: string | null;
  actorType: ActorType;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditLogView {
  id: string;
  actorId: string | null;
  actorType: ActorType;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditListQuery {
  tenantId: string;
  action?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface AuditPage {
  data: AuditLogView[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogs {
  record(draft: AuditDraft, tx: TransactionContext): Promise<void>;
  list(query: AuditListQuery): Promise<AuditPage>;
}

export const AUDIT_LOGS = Symbol('AUDIT_LOGS');
