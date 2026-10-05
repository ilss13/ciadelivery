import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';
import { centsToReais } from '../settings/money';
import { dashboardErrorMessage } from './dashboard-messages';

interface DashboardSnapshot {
  newCount: number;
  inPreparationCount: number;
  readyCount: number;
  outForDeliveryCount: number;
  deliveredTodayCount: number;
  revenueCents: number;
  storeOpen: boolean;
  whatsappConnected: boolean;
}

@Component({
  selector: 'admin-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly snapshot = signal<DashboardSnapshot | null>(null);

  ngOnInit(): void {
    this.http
      .get<DashboardSnapshot>(apiUrl('/api/v1/admin/dashboard'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.snapshot.set(body);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(dashboardErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  reais(cents: number): string {
    return `R$ ${centsToReais(cents)}`;
  }

  showOrders(): boolean {
    return canReadOrders(this.session.user());
  }

  showCatalog(): boolean {
    return canManageCatalog(this.session.user());
  }

  showCustomers(): boolean {
    return canReadCustomers(this.session.user());
  }

  showReports(): boolean {
    return canReadReports(this.session.user());
  }

  showSettings(): boolean {
    return canConfigure(this.session.user());
  }

  showTeam(): boolean {
    return canManageUsers(this.session.user());
  }

  showWhatsApp(): boolean {
    return canOperateWhatsApp(this.session.user());
  }
}
