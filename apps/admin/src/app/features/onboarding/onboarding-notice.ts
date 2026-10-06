import { Injectable, signal } from '@angular/core';
import { OnboardingChecklist } from './onboarding-messages';

@Injectable({ providedIn: 'root' })
export class OnboardingNotice {
  readonly checklist = signal<OnboardingChecklist | null>(null);
}
