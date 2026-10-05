import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  canConfigure,
  canManageCatalog,
  canManageUsers,
  canOperateWhatsApp,
  canReadCustomers,
  canReadOrders,
  canReadReports,
} from '../../core/access';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'admin-home-page',
  imports: [RouterLink],
  template: `
    <h1>Início</h1>
    @if (canReadOrders()) {
      <p><a routerLink="/">Abrir o painel de hoje</a></p>
    }
    @if (canReadOrders()) {
      <p><a routerLink="/pedidos">Abrir pedidos</a></p>
    }
    @if (canManageCatalog()) {
      <p><a routerLink="/cardapio">Abrir cardápio</a></p>
    }
    @if (canReadCustomers()) {
      <p><a routerLink="/clientes">Abrir clientes</a></p>
    }
    @if (canReadReports()) {
      <p><a routerLink="/relatorios">Abrir relatórios</a></p>
    }
    @if (canConfigure()) {
      <p><a routerLink="/configuracoes">Abrir configurações da loja</a></p>
    }
    @if (canManageUsers()) {
      <p><a routerLink="/equipe">Abrir equipe</a></p>
    }
    @if (canOperateWhatsApp()) {
      <p><a routerLink="/whatsapp">Abrir conversas</a></p>
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

  canReadReports(): boolean {
    return canReadReports(this.session.user());
  }

  canManageUsers(): boolean {
    return canManageUsers(this.session.user());
  }

  canOperateWhatsApp(): boolean {
    return canOperateWhatsApp(this.session.user());
  }
}
