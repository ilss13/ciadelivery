import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { OnboardingPage } from './onboarding-page';
import { OnboardingChecklist } from './onboarding-messages';

describe('OnboardingPage', () => {
  it('shows the next step and only offers a manual mark for training', async () => {
    const fixture = create(true);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((call) => call.url.endsWith('/api/v1/admin/onboarding')).flush(
      checklist(),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Configurar os horários');
    expect(text).toContain('Marcar como feito');
    expect(text).toContain('Publicar loja');
    expect(text).toContain('Falta Configurar os horários, Cadastrar o cardápio.');
    const buttons = [...fixture.nativeElement.querySelectorAll('button')].map(
      (button: HTMLButtonElement) => button.textContent?.trim(),
    );
    expect(buttons.filter((label) => label === 'Marcar como feito')).toHaveLength(1);
    http.verify();
  });

  it('hides publish from someone who cannot configure the store', async () => {
    const fixture = create(false);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((call) => call.url.endsWith('/api/v1/admin/onboarding')).flush(
      checklist(),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Publicar loja');
    http.verify();
  });
});

function checklist(): OnboardingChecklist {
  return {
    published: false,
    nextCode: 'configure_hours',
    blockingCodes: ['configure_hours', 'import_catalog'],
    steps: [
      {
        code: 'configure_hours',
        status: 'PENDING',
        doneAt: null,
        doneBy: null,
        note: null,
      },
      {
        code: 'train_team',
        status: 'PENDING',
        doneAt: null,
        doneBy: null,
        note: null,
      },
      {
        code: 'configure_branding',
        status: 'DONE',
        doneAt: null,
        doneBy: null,
        note: null,
      },
    ],
  };
}

function create(configure: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: SessionService,
        useValue: {
          user: () => ({
            id: 'user-1',
            name: 'Ana',
            email: 'ana@example.com',
            role: 'OWNER',
            permissions: configure ? ['store.configure'] : ['orders.read'],
          }),
          currentUser: signal(null),
        },
      },
    ],
  });
  return TestBed.createComponent(OnboardingPage);
}
