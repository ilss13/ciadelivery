import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { homePath } from './access';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.accessToken() !== null && session.user() !== null) {
    return true;
  }

  const profile = session.accessToken()
    ? session.loadProfile()
    : session.refresh().pipe(switchMap(() => session.loadProfile()));

  return profile.pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const user = session.user();
  if (user === null) {
    return true;
  }

  return router.createUrlTree([homePath(user)]);
};
