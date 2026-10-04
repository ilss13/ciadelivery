import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextState {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextState>();

export function currentRequestId(): string | null {
  return requestContext.getStore()?.requestId ?? null;
}
