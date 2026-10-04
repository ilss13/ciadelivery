import { HttpErrorResponse } from '@angular/common/http';

export function readErrorCode(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'INTERNAL_ERROR';
  }

  const body = error.error as { error?: { code?: unknown } } | null;
  const code = body?.error?.code;
  return typeof code === 'string' ? code : 'INTERNAL_ERROR';
}
