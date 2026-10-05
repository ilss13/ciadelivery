import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  canConfigure,
  canManageCatalog,
  canManageUsers,
  canReadAudit,
  canOperateWhatsApp,
  canReadCustomers,
  canReadOrders,
  canReadReports,
  isKitchen,
} from '../../core/access';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'admin-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './shell.html',
})
export class ShellPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly user = this.session.currentUser;

  canConfigure(): boolean {
    return canConfigure(this.user());
  }

  canManageCatalog(): boolean {
    return canManageCatalog(this.user());
  }

  canReadCustomers(): boolean {
    return canReadCustomers(this.user());
  }

  canReadOrders(): boolean {
    return canReadOrders(this.user());
  }

  showDashboard(): boolean {
    return canReadOrders(this.user()) && !isKitchen(this.user());
  }

  canOperateWhatsApp(): boolean {
    return canOperateWhatsApp(this.user());
  }

  canReadAudit(): boolean {
    return canReadAudit(this.user());
  }

  canReadReports(): boolean {
    return canReadReports(this.user());
  }

  canManageUsers(): boolean {
    return canManageUsers(this.user());
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }
}
