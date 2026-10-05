import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  canConfigure,
  canManageCatalog,
  canManageUsers,
  canReadAudit,
  canOperateWhatsApp,
  canReadCustomers,
  canReadOrders,
  canReadReports,
  homePath,
  isKitchen,
} from './access';
import { SessionService } from './session.service';

export const configureGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canConfigure(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const customersGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canReadCustomers(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const ordersGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canReadOrders(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const whatsappGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canOperateWhatsApp(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const auditGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canReadAudit(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const reportsGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canReadReports(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const catalogGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canManageCatalog(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const usersGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  if (canManageUsers(session.user())) {
    return true;
  }

  return inject(Router).createUrlTree(['/inicio']);
};

export const dashboardGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const user = session.user();
  if (isKitchen(user)) {
    return inject(Router).createUrlTree(['/pedidos']);
  }
  if (canReadOrders(user)) {
    return true;
  }

  const next = homePath(user);
  if (next === '/') {
    return inject(Router).createUrlTree(['/inicio']);
  }
  return inject(Router).createUrlTree([next]);
};
