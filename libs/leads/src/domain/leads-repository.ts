import { Lead } from './lead';

export const LEADS = Symbol('LEADS');

export interface LeadsRepository {
  insert(lead: Lead): Promise<void>;
}
