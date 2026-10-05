import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TrackingPage } from './tracking-page';

describe('TrackingPage', () => {
  it('shows Pedido realizado from the history and retries a failed load', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ trackingToken: 'token-opaco' }) },
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TrackingPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((call) => call.url.endsWith('/api/v1/public/store')).forEach((call) => {
      call.flush({
        name: 'Pizzaria',
        phone: '1',
        address: {
          line: 'Rua',
          number: '1',
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01001000',
        },
        branding: {
          displayName: 'Pizzaria',
          logoUrl: null,
          faviconUrl: null,
          bannerUrl: null,
          primaryColor: '#111111',
          secondaryColor: '#ffffff',
          accentColor: '#111111',
          seoTitle: '',
          seoDescription: '',
        },
        slug: 'pizzariadoze',
        minimumOrderCents: 0,
        isOpen: true,
      });
    });
    const failed = http.expectOne((call) =>
      call.url.endsWith('/api/v1/public/orders/token-opaco'),
    );
    failed.error(new ProgressEvent('error'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tentar de novo');

    const retry = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Tentar de novo'),
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    const loaded = http.expectOne((call) =>
      call.url.endsWith('/api/v1/public/orders/token-opaco'),
    );
    loaded.flush({
      orderId: 'order-1',
      orderNumber: 12,
      status: 'NEW',
      fulfillment: 'DELIVERY',
      paymentLabel: 'PIX',
      paymentInstructions: 'Chave pix@loja.com',
      customerName: 'Ana',
      address: null,
      subtotalCents: 1000,
      deliveryFeeCents: 0,
      totalCents: 1000,
      createdAt: '2026-10-04T18:00:00.000Z',
      items: [
        {
          productName: 'Calabresa',
          quantity: 1,
          notes: null,
          options: [{ name: 'Borda' }],
          subtotalCents: 1000,
        },
      ],
      history: [{ toStatus: 'NEW', createdAt: '2026-10-04T18:00:00.000Z' }],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pedido realizado');
    expect(fixture.nativeElement.textContent).toContain('Pedido 12');
    expect(fixture.nativeElement.textContent).toContain('Chave pix@loja.com');
    expect(fixture.nativeElement.textContent).toContain('Borda');
    http.verify();
  });
});
