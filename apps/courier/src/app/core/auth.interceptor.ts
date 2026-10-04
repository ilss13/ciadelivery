import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { RETRIED, SKIP_AUTH } from './auth-context';
import { SessionService } from './session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const outgoing = authorize(request, session.accessToken());

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        request.context.get(SKIP_AUTH) ||
        request.context.get(RETRIED)
      ) {
        return throwError(() => error);
      }

      return session.refresh().pipe(
        switchMap((token) =>
          next(
            authorize(
              request.clone({
                context: request.context.set(RETRIED, true),
              }),
              token,
            ),
          ),
        ),
        catchError((refreshError: unknown) => {
          session.clear();
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function authorize(
  request: Parameters<HttpInterceptorFn>[0],
  token: string | null,
) {
  if (request.context.get(SKIP_AUTH) || token === null) {
    return request;
  }

  return request.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}
