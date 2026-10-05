export const IDENTIFY_RATE_LIMIT = Symbol('IDENTIFY_RATE_LIMIT');
export const IDENTIFY_LIMIT = 20;
export const IDENTIFY_WINDOW_SECONDS = 60;

export interface IdentifyRateLimit {
  consume(ip: string): Promise<void>;
}
