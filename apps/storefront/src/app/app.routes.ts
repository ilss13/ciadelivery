import { Route } from '@angular/router';
import { CheckoutPage } from './features/checkout/checkout-page';
import { StorePage } from './features/store/store-page';
import { TrackingPage } from './features/tracking/tracking-page';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', component: StorePage },
  { path: 'checkout', component: CheckoutPage },
  { path: 'pedido/:trackingToken', component: TrackingPage },
];
