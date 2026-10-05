import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { BusinessDay } from './business-hours';

export interface BusinessHoursRepository {
  listCurrent(): Promise<BusinessDay[]>;
  replace(
    days: readonly BusinessDay[],
    tx?: TransactionContext,
  ): Promise<BusinessDay[]>;
}

export const BUSINESS_HOURS = Symbol('BUSINESS_HOURS');
