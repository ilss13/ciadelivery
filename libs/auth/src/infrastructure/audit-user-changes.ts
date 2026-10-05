import {
  actorTypeOf,
  AuditLogs,
  recordAudit,
  recordChanged,
} from '@ciadelivery/audit';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { UserChange, UserChanges } from '@ciadelivery/users';

export class AuditUserChanges implements UserChanges {
  constructor(private readonly audit: AuditLogs) {}

  async record(change: UserChange, tx: TransactionContext): Promise<void> {
    if (change.before === null) {
      await recordAudit(this.audit, tx, {
        tenantId: change.tenantId,
        actorId: change.actor.userId,
        actorType: actorTypeOf(change.actor.role),
        action: change.action,
        entityType: 'user',
        entityId: change.userId,
        before: null,
        changes: change.after,
      });
      return;
    }

    await recordChanged(this.audit, tx, {
      tenantId: change.tenantId,
      actor: change.actor,
      action: change.action,
      entityType: 'user',
      entityId: change.userId,
      before: change.before,
      after: change.after,
    });
  }
}
