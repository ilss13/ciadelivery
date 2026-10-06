import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';
import {
  OnboardingChecklist,
  stepLabel,
} from '../onboarding/onboarding-messages';
import { OnboardingNotice } from '../onboarding/onboarding-notice';

@Component({
  selector: 'admin-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './shell.html',
})
export class ShellPage implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly notice = inject(OnboardingNotice);

  readonly user = this.session.currentUser;

  ngOnInit(): void {
    this.http
      .get<OnboardingChecklist>(apiUrl('/api/v1/admin/onboarding'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => this.notice.checklist.set(body),
        error: () => this.notice.checklist.set(null),
      });
  }

  nextStep(): string {
    const code = this.notice.checklist()?.nextCode;
    return code === null || code === undefined ? 'Revisar a implantação' : stepLabel(code);
  }

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
