import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { periodPreset } from './reports-messages';
import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  it('explains an empty period', async () => {
    const fixture = create();
    fixture.detectChanges();
    flushReports(TestBed.inject(HttpTestingController), emptyOverview());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sem pedidos no período.');
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows revenue, products, recurring customers and couriers', async () => {
    const fixture = create();
    fixture.detectChanges();
    flushReports(TestBed.inject(HttpTestingController), {
      orderCount: 3,
      revenueCents: 3000,
      averageTicketCents: 1500,
      cancelledCount: 1,
      byStatus: [
        { status: 'DELIVERED', count: 2 },
        { status: 'CANCELLED', count: 1 },
      ],
      bySource: [
        { source: 'STOREFRONT', count: 3 },
        { source: 'WHATSAPP', count: 0 },
      ],
    }, {
      products: [
        {
          productId: 'product-1',
          productName: 'Margherita',
          quantity: 2,
          subtotalCents: 3000,
        },
      ],
      customers: [
        {
          customerId: 'customer-1',
          name: 'Ana',
          maskedPhone: '*******7777',
          orderCount: 3,
        },
      ],
      couriers: [
        { courierId: 'courier-1', name: 'Lia', deliveredCount: 1 },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('R$ 30,00');
    expect(text).toContain('R$ 15,00');
    expect(text).toContain('Entregue: 2');
    expect(text).toContain('Loja: 3');
    expect(text).toContain('Margherita');
    expect(text).toContain('*******7777');
    expect(text).toContain('Lia');
    expect(text).not.toContain('11988887777');
    TestBed.inject(HttpTestingController).verify();
  });

  it('exports the visible period as a CSV attachment', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushReports(http, emptyOverview());
    await fixture.whenStable();
    fixture.detectChanges();

    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:pedidos';
    URL.revokeObjectURL = () => undefined;

    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate) => (candidate.textContent ?? '').includes('Exportar CSV'),
    ) as HTMLButtonElement;
    button.click();

    const preset = periodPreset('7');
    const request = http.expectOne(
      (candidate) => candidate.url.includes('/api/v1/admin/reports/orders.csv'),
    );
    expect(request.request.params.get('from')).toBe(preset.from);
    expect(request.request.params.get('to')).toBe(preset.to);
    request.flush(new Blob(['número;data\n']));
    await fixture.whenStable();

    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(ReportsPage);
}

function emptyOverview() {
  return {
    orderCount: 0,
    revenueCents: 0,
    averageTicketCents: 0,
    cancelledCount: 0,
    byStatus: [],
    bySource: [],
  };
}

function flushReports(
  http: HttpTestingController,
  overview: ReturnType<typeof emptyOverview>,
  extra: {
    products?: unknown[];
    customers?: unknown[];
    couriers?: unknown[];
  } = {},
): void {
  http
    .expectOne((candidate) => candidate.url.includes('/reports/overview'))
    .flush(overview);
  http
    .expectOne((candidate) => candidate.url.includes('/reports/products'))
    .flush(extra.products ?? []);
  http
    .expectOne((candidate) => candidate.url.includes('/reports/customers'))
    .flush(extra.customers ?? []);
  http
    .expectOne((candidate) => candidate.url.includes('/reports/couriers'))
    .flush(extra.couriers ?? []);
}
