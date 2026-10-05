import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrdersPage } from './orders-page';

describe('OrdersPage', () => {
  it('lists number, time, total, status and fulfillment', async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((call) => call.url.includes('/api/v1/admin/orders'));
    expect(request.request.params.get('page')).toBe('1');
    request.flush({
      data: [
        {
          id: 'order-1',
          orderNumber: 4,
          createdAt: '2026-10-04T18:30:00.000Z',
          totalCents: 5640,
          status: 'NEW',
          fulfillment: 'DELIVERY',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pedido 4');
    expect(text).toContain('R$ 56,40');
    expect(text).toContain('Pedido realizado');
    expect(text).toContain('Entrega');
    expect(text).not.toContain('Aceitar');
    http.verify();
  });
});