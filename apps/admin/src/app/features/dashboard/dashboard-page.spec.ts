import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('shows the day and only the shortcuts the person can open', async () => {
    const fixture = create(['orders.read', 'catalog.manage']);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((candidate) => candidate.url.includes('/api/v1/admin/dashboard'))
      .flush({
      newCount: 2,
      inPreparationCount: 1,
      readyCount: 0,
      outForDeliveryCount: 3,
      deliveredTodayCount: 4,
      revenueCents: 2590,
      storeOpen: true,
      whatsappConnected: false,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Novos agora');
    expect(text).toContain('2');
    expect(text).toContain('Em preparo');
    expect(text).toContain('Em rota');
    expect(text).toContain('Entregues hoje');
    expect(text).toContain('R$ 25,90');
    expect(text).toContain('Loja aberta');
    expect(text).toContain('WhatsApp desconectado');
    expect(text).toContain('Pedidos');
    expect(text).toContain('Cardápio');
    expect(text).not.toContain('Relatórios');
    expect(text).not.toContain('Equipe');
    expect(text).not.toContain('Configurações');
    http.verify();
  });
});

function create(permissions: string[]) {
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
            role: 'MANAGER',
            permissions,
          }),
        },
      },
    ],
  });
  return TestBed.createComponent(DashboardPage);
}
