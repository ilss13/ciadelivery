import { RequestActor } from '@ciadelivery/users';
import { CurrentStore } from '@ciadelivery/stores';
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

export class ReplaceBusinessHours {
  constructor(
    private readonly stores: CurrentStore,
    private readonly hours: BusinessHoursRepository,
  ) {}

  async execute(
    actor: RequestActor,
    days: readonly BusinessDay[],
  ): Promise<BusinessDay[]> {
    await requireActorStore(actor, this.stores);
    return this.hours.replace(days);
  }
}
