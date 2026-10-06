export const PUBLIC_ORDER_LIMIT = 20;
export const PUBLIC_ORDER_WINDOW_SECONDS = 60;

export interface PublicOrderRateLimit {
  consume(tenantId: string, ip: string): Promise<void>;
}

export const PUBLIC_ORDER_RATE_LIMIT = Symbol('PUBLIC_ORDER_RATE_LIMIT');
