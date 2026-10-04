import { Route } from '@angular/router';
import { StorePage } from './features/store/store-page';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', component: StorePage },
];
