import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { canConfigure } from '../../core/access';
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';
import {
  OnboardingChecklist,
  OnboardingStep,
  canMarkManually,
  canSkip,
  onboardingErrorMessage,
  statusLabel,
  stepLabel,
  stepLink,
} from './onboarding-messages';
import { OnboardingNotice } from './onboarding-notice';

@Component({
  selector: 'admin-onboarding-page',
  imports: [RouterLink],
  templateUrl: './onboarding-page.html',
})
export class OnboardingPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly notice = inject(OnboardingNotice);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly checklist = signal<OnboardingChecklist | null>(null);

  ngOnInit(): void {
    this.load();
  }

  label(code: string): string {
    return stepLabel(code);
  }

  link(code: string): string | null {
    return stepLink(code);
  }

  status(step: OnboardingStep): string {
    return statusLabel(step.status);
  }

  showComplete(step: OnboardingStep): boolean {
    return canMarkManually(step);
  }

  showSkip(step: OnboardingStep): boolean {
    return canSkip(step);
  }

  canPublish(): boolean {
    return canConfigure(this.session.user());
  }

  blockingLabels(): string {
    return (this.checklist()?.blockingCodes ?? []).map(stepLabel).join(', ');
  }

  markDone(code: string): void {
    this.post(`/api/v1/admin/onboarding/${code}/complete`);
  }

  skip(code: string): void {
    this.post(`/api/v1/admin/onboarding/${code}/skip`);
  }

  publish(): void {
    this.post('/api/v1/admin/store/publish');
  }

  unpublish(): void {
    if (!confirm('A loja deixa de aparecer para os clientes. Continuar?')) {
      return;
    }
    this.post('/api/v1/admin/store/unpublish');
  }

  private load(): void {
    this.http
      .get<OnboardingChecklist>(apiUrl('/api/v1/admin/onboarding'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => this.show(body),
        error: (error: unknown) => {
          this.error.set(onboardingErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  private post(path: string): void {
    this.saving.set(true);
    this.error.set('');
    this.http
      .post<OnboardingChecklist>(apiUrl(path), {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.saving.set(false);
          this.show(body);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(onboardingErrorMessage(error));
        },
      });
  }

  private show(body: OnboardingChecklist): void {
    this.checklist.set(body);
    this.notice.checklist.set(body);
    this.loading.set(false);
  }
}
