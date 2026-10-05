import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { TrackingFeed, TrackingMessage, TRACKING_FEED } from './tracking-feed';
import { TrackingPage } from './tracking-page';

class FakeTrackingFeed implements TrackingFeed {
  readonly messages = new Subject<TrackingMessage>();

  watch() {
    return this.messages.asObservable();
  }
}

describe('TrackingPage', () => {
  let feed: FakeTrackingFeed;

  beforeEach(() => {
    feed = new FakeTrackingFeed();
  });

  it('shows Pedido realizado from the history and retries a failed load', async () => {
    const fixture = await mount(feed);
    const http = TestBed.inject(HttpTestingController);
    flushStore(http);
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
    loaded.flush(orderPayload());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pedido realizado');
    expect(fixture.nativeElement.textContent).toContain('Pedido 12');
    expect(fixture.nativeElement.textContent).toContain('Chave pix@loja.com');
    expect(fixture.nativeElement.textContent).toContain('Borda');
    http.verify();
  });

  it('appends the timeline when the socket reports a status change', async () => {
    const fixture = await mount(feed);
    const http = TestBed.inject(HttpTestingController);
    flushStore(http);
    http
      .expectOne((call) => call.url.endsWith('/api/v1/public/orders/token-opaco'))
      .flush(orderPayload());
    await fixture.whenStable();
    fixture.detectChanges();

    feed.messages.next({
      kind: 'event',
      event: {
        orderId: 'order-1',
        status: 'ACCEPTED',
        orderNumber: 12,
        occurredAt: '2026-10-04T18:05:00.000Z',
      },
    });
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status-label') as HTMLElement;
    const timeline = fixture.nativeElement.querySelector('.timeline') as HTMLElement;
    expect(status.textContent).toContain('Aceito');
    const timelineText = timeline.textContent ?? '';
    expect(timelineText.indexOf('Pedido realizado')).toBeLessThan(
      timelineText.indexOf('Aceito'),
    );
    expect(fixture.nativeElement.textContent).not.toContain('reconectando');

    feed.messages.next({
      kind: 'event',
      event: {
        orderId: 'other-order',
        status: 'READY',
        orderNumber: 99,
        occurredAt: '2026-10-04T18:06:00.000Z',
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Pronto');
    http.verify();
  });

  it('shows the refusal note from the public order and reloads after reconnect', async () => {
    const fixture = await mount(feed);
    const http = TestBed.inject(HttpTestingController);
    flushStore(http);
    http
      .expectOne((call) => call.url.endsWith('/api/v1/public/orders/token-opaco'))
      .flush(
        orderPayload({
          status: 'REJECTED',
          history: [
            { toStatus: 'NEW', createdAt: '2026-10-04T18:00:00.000Z', note: null },
            {
              toStatus: 'REJECTED',
              createdAt: '2026-10-04T18:02:00.000Z',
              note: 'Forno desligado',
              actorType: 'USER',
            },
          ],
        }),
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Recusado');
    expect(fixture.nativeElement.textContent).toContain('Forno desligado');

    feed.messages.next({ kind: 'reconnecting' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('reconectando');

    feed.messages.next({ kind: 'resynced' });
    const refreshed = http.expectOne((call) =>
      call.url.endsWith('/api/v1/public/orders/token-opaco'),
    );
    refreshed.flush(
      orderPayload({
        status: 'ACCEPTED',
        history: [
          { toStatus: 'NEW', createdAt: '2026-10-04T18:00:00.000Z', note: null },
          { toStatus: 'ACCEPTED', createdAt: '2026-10-04T18:03:00.000Z', note: null },
        ],
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aceito');
    expect(fixture.nativeElement.textContent).not.toContain('reconectando');
    http.verify();
  });

  it('reloads the public order when a cancellation arrives so the note shows', async () => {
    const fixture = await mount(feed);
    const http = TestBed.inject(HttpTestingController);
    flushStore(http);
    http
      .expectOne((call) => call.url.endsWith('/api/v1/public/orders/token-opaco'))
      .flush(orderPayload());
    await fixture.whenStable();
    fixture.detectChanges();

    feed.messages.next({
      kind: 'event',
      event: {
        orderId: 'order-1',
        status: 'CANCELLED',
        orderNumber: 12,
        occurredAt: '2026-10-04T18:04:00.000Z',
      },
    });
    const refreshed = http.expectOne((call) =>
      call.url.endsWith('/api/v1/public/orders/token-opaco'),
    );
    refreshed.flush(
      orderPayload({
        status: 'CANCELLED',
        history: [
          { toStatus: 'NEW', createdAt: '2026-10-04T18:00:00.000Z', note: null },
          {
            toStatus: 'CANCELLED',
            createdAt: '2026-10-04T18:04:00.000Z',
            note: 'Cliente desistiu',
          },
        ],
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cancelado');
    expect(fixture.nativeElement.textContent).toContain('Cliente desistiu');
    http.verify();
  });
});

async function mount(feed: FakeTrackingFeed): Promise<ComponentFixture<TrackingPage>> {
  await TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: TRACKING_FEED, useValue: feed },
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
  return fixture;
}

function flushStore(http: HttpTestingController): void {
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
}

function orderPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
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
    history: [{ toStatus: 'NEW', createdAt: '2026-10-04T18:00:00.000Z', note: null }],
    ...overrides,
  };
}
