import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ShellPage } from './shell';

describe('ShellPage', () => {
  it('shows the next onboarding step while the store is unpublished', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((call) => call.url.endsWith('/api/v1/admin/onboarding')).flush({
      published: false,
      nextCode: 'configure_branding',
      blockingCodes: ['configure_branding'],
      steps: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Próxima etapa: Configurar a marca.');
    expect(text).toContain('Abrir implantação');
    http.verify();
  });

  it('hides the banner after the store is published', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((call) => call.url.endsWith('/api/v1/admin/onboarding')).flush({
      published: true,
      nextCode: null,
      blockingCodes: [],
      steps: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('ainda não está no ar');
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: SessionService,
        useValue: {
          currentUser: signal({
            id: 'user-1',
            name: 'Ana',
            email: 'ana@example.com',
            role: 'OWNER',
            permissions: ['store.configure'],
          }),
          logout: () => undefined,
        },
      },
    ],
  });
  return TestBed.createComponent(ShellPage);
}
