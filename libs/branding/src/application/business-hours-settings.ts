import { AuditLogs, recordChanged } from '@ciadelivery/audit';
import { RequestActor } from '@ciadelivery/users';
import { CurrentStore } from '@ciadelivery/stores';
import { TransactionContext, UnitOfWork } from '@ciadelivery/tenancy/domain';
import { BusinessDay, completeWeek } from '../domain/business-hours';
import { BusinessHoursRepository } from '../domain/business-hours-repository';
import { requireActorStore } from './actor-store';

export class GetBusinessHours {
  constructor(
    private readonly stores: CurrentStore,
    private readonly hours: BusinessHoursRepository,
  ) {}

  async execute(actor: RequestActor): Promise<BusinessDay[]> {
    await requireActorStore(actor, this.stores);
    return completeWeek(await this.hours.listCurrent());
  }
}

type StepMarker = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

const idleSteps: StepMarker = {
  async markDone(): Promise<void> {
    return undefined;
  },
};

export class ReplaceBusinessHours {
  constructor(
    private readonly stores: CurrentStore,
    private readonly hours: BusinessHoursRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
    private readonly steps: StepMarker = idleSteps,
  ) {}

  async execute(
    actor: RequestActor,
    days: readonly BusinessDay[],
  ): Promise<BusinessDay[]> {
    const store = await requireActorStore(actor, this.stores);
    const current = await this.hours.listCurrent();
    return this.unitOfWork.run(async (tx) => {
      const saved = await this.hours.replace(days, tx);
      await recordChanged(this.audit, tx, {
        tenantId: store.tenantId,
        actor,
        action: 'business_hours.updated',
        entityType: 'business_hours',
        entityId: store.id,
        before: { hours: current },
        after: { hours: saved },
      });
      await this.steps.markDone(
        {
          tenantId: store.tenantId,
          code: 'configure_hours',
          actorId: actor.userId,
        },
        tx,
      );
      return saved;
    });
  }
}
