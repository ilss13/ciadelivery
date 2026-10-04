import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { canConfigure } from './access';
import { SessionService } from './session.service';

export const configureGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canConfigure(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};
