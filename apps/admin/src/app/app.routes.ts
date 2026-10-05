import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import {
  catalogGuard,
  configureGuard,
  customersGuard,
  ordersGuard,
  whatsappGuard,
} from './core/settings.guard';
import { CustomersPage } from './features/customers/customers-page';
import { OrdersPage } from './features/orders/orders-page';
import { CatalogPage } from './features/catalog/catalog-page';
import { ProductEditor } from './features/catalog/product-editor';
import { HomePage, HomeRedirect } from './features/home/home-page';
import { LoginPage } from './features/login/login-page';
import {
  discardSettingsGuard,
  SettingsPage,
} from './features/settings/settings-page';
import { ShellPage } from './features/shell/shell';
import { ConversationsPage } from './features/whatsapp/conversations-page';

export const appRoutes: Route[] = [
  {
    path: 'login',
    component: LoginPage,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: ShellPage,
    canActivate: [authGuard],
    children: [
      {
        path: 'configuracoes',
        component: SettingsPage,
        canActivate: [configureGuard],
        canDeactivate: [discardSettingsGuard],
      },
      {
        path: 'cardapio/produtos/novo',
        component: ProductEditor,
        canActivate: [catalogGuard],
      },
      {
        path: 'cardapio/produtos/:productId',
        component: ProductEditor,
        canActivate: [catalogGuard],
      },
      {
        path: 'cardapio',
        component: CatalogPage,
        canActivate: [catalogGuard],
      },
      {
        path: 'clientes',
        component: CustomersPage,
        canActivate: [customersGuard],
      },
      {
        path: 'pedidos',
        component: OrdersPage,
        canActivate: [ordersGuard],
      },
      {
        path: 'whatsapp',
        component: ConversationsPage,
        canActivate: [whatsappGuard],
      },
      { path: 'inicio', component: HomePage },
      { path: '', pathMatch: 'full', component: HomeRedirect },
    ],
  },
];
