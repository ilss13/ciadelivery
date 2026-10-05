import { DomainException } from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';
import { AuditListQuery, AuditLogs, AuditPage } from '../domain/audit-log';

export interface ListAuditQuery {
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export class ListAuditLogs {
  constructor(private readonly logs: AuditLogs) {}

  execute(actor: RequestActor, query: ListAuditQuery): Promise<AuditPage> {
    if (actor.tenantId === null) {
      throw new DomainException('FORBIDDEN', 'The permission is required', 403);
    }
    const from = parseInstant(query.from, 'from');
    const to = parseInstant(query.to, 'to');
    if (
      from !== undefined &&
      to !== undefined &&
      from.getTime() > to.getTime()
    ) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
      );
    }
    const listed: AuditListQuery = {
      tenantId: actor.tenantId,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.action === undefined || query.action.length === 0
        ? {}
        : { action: query.action }),
      ...(query.entityType === undefined || query.entityType.length === 0
        ? {}
        : { entityType: query.entityType }),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
    };
    return this.logs.list(listed);
  }
}

function parseInstant(
  value: string | undefined,
  field: string,
): Date | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainException(
      'VALIDATION_ERROR',
      `The ${field} instant is invalid`,
      400,
    );
  }
  return parsed;
}
