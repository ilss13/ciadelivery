import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  canConfigure,
  canManageCatalog,
  canReadCustomers,
  canReadOrders,
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

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }
}
