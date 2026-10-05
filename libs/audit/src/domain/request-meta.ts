import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestMeta>();

export function runWithAuditMeta<T>(meta: AuditRequestMeta, fn: () => T): T {
  return storage.run(meta, fn);
}

export function currentAuditMeta(): AuditRequestMeta {
  return storage.getStore() ?? { ip: null, userAgent: null };
}
