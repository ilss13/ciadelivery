import { BusinessDay } from './business-hours';

export interface BusinessHoursRepository {
  listCurrent(): Promise<BusinessDay[]>;
  replace(days: readonly BusinessDay[]): Promise<BusinessDay[]>;
}

export const BUSINESS_HOURS = Symbol('BUSINESS_HOURS');
