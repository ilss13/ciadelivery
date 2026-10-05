import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  canConfigure,
  canManageCatalog,
  canReadCustomers,
  canReadOrders,
  homePath,
} from '../../core/access';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'admin-home-redirect',
  template: '',
})
export class HomeRedirect {
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  constructor() {
    void this.router.navigateByUrl(homePath(this.session.user()), {
      replaceUrl: true,
    });
  }
}

@Component({
  selector: 'admin-home-page',
  imports: [RouterLink],
  template: `
    <h1>Início</h1>
    @if (canConfigure()) {
      <p><a routerLink="/configuracoes">Abrir configurações da loja</a></p>
    }
    @if (canManageCatalog()) {
      <p><a routerLink="/cardapio">Abrir cardápio</a></p>
    }
    @if (canReadOrders()) {
      <p><a routerLink="/pedidos">Abrir pedidos</a></p>
    }
    @if (canReadCustomers()) {
      <p><a routerLink="/clientes">Abrir clientes</a></p>
    }
    @if (!canConfigure() && !canManageCatalog() && !canReadCustomers() && !canReadOrders()) {
      <p>Você não tem acesso à configuração da loja.</p>
    }
  `,
})
export class HomePage {
  private readonly session = inject(SessionService);

  canConfigure(): boolean {
    return canConfigure(this.session.user());
  }

  canManageCatalog(): boolean {
    return canManageCatalog(this.session.user());
  }

  canReadCustomers(): boolean {
    return canReadCustomers(this.session.user());
  }

  canReadOrders(): boolean {
    return canReadOrders(this.session.user());
  }
}
