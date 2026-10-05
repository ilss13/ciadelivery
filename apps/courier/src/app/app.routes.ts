import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { DeliveriesPage } from './features/deliveries/deliveries-page';
import { DeliveryDetailPage } from './features/deliveries/delivery-detail-page';
import { HistoryPage } from './features/deliveries/history-page';
import { LoginPage } from './features/login/login-page';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  {
    path: '',
    pathMatch: 'full',
    component: DeliveriesPage,
    canActivate: [authGuard],
  },
  {
    path: 'orders/:id',
    component: DeliveryDetailPage,
    canActivate: [authGuard],
  },
  {
    path: 'history',
    component: HistoryPage,
    canActivate: [authGuard],
  },
];
