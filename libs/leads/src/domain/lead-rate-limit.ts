export const LEAD_RATE_LIMIT = Symbol('LEAD_RATE_LIMIT');
export const LEAD_LIMIT = 5;
export const LEAD_WINDOW_SECONDS = 60 * 60;

export interface LeadRateLimit {
  consume(ip: string): Promise<void>;
}
