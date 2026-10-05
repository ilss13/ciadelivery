import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { ActorType, AuditDraft, AuditLogs } from './audit-log';
import { currentAuditMeta } from './request-meta';

export function actorTypeOf(role: string): ActorType {
  if (role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }
  if (role === 'SYSTEM') {
    return 'SYSTEM';
  }
  return 'USER';
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) {
    return '***';
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain.length === 0) {
    return '***';
  }
  return `${local.slice(0, 1)}***@${domain}`;
}

export function isAuditSecretKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  return (
    normalized.includes('password') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('credential') ||
    normalized === 'refresh' ||
    normalized.includes('refreshtoken') ||
    normalized === 'cvv' ||
    normalized === 'pan' ||
    normalized.includes('cardnumber') ||
    normalized.includes('trackingtoken')
  );
}

export function sanitizeAudit(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }
  return sanitizeValue(value) as Record<string, unknown>;
}

export function fieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; changes: Record<string, unknown> } | null {
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (sameJson(before[key], after[key])) {
      continue;
    }
    previous[key] = before[key] ?? null;
    next[key] = after[key] ?? null;
  }
  if (Object.keys(next).length === 0) {
    return null;
  }
  return { before: previous, changes: next };
}

export async function recordAudit(
  audit: AuditLogs,
  tx: TransactionContext,
  draft: Omit<AuditDraft, 'ip' | 'userAgent'>,
): Promise<void> {
  const meta = currentAuditMeta();
  await audit.record(
    {
      ...draft,
      before: sanitizeAudit(draft.before),
      changes: sanitizeAudit(draft.changes),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
    tx,
  );
}

export async function recordChanged(
  audit: AuditLogs,
  tx: TransactionContext,
  input: {
    tenantId: string | null;
    actor: { userId: string; role: string };
    action: string;
    entityType: string;
    entityId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): Promise<void> {
  const diff = fieldChanges(input.before, input.after);
  if (diff === null) {
    return;
  }
  await recordAudit(audit, tx, {
    tenantId: input.tenantId,
    actorId: input.actor.userId,
    actorType: actorTypeOf(input.actor.role),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: diff.before,
    changes: diff.changes,
  });
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isAuditSecretKey(key)) {
    return '[redacted]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[childKey] = sanitizeValue(childValue, childKey);
    }
    return output;
  }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
