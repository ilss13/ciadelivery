import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { HomePage } from './features/home/home-page';
import { LoginPage } from './features/login/login-page';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  {
    path: '',
    pathMatch: 'full',
    component: HomePage,
    canActivate: [authGuard],
  },
];
