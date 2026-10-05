import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartStore } from '../cart/cart-store';
import { CheckoutPage } from './checkout-page';

@Component({ template: 'acompanhamento' })
class TrackingStub {}

describe('CheckoutPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('shows the delivery fee returned by the server and sends one order', async () => {
    const fixture = await create();
    const http = TestBed.inject(HttpTestingController);
    flushOpening(http);
    await fixture.whenStable();
    fixture.detectChanges();

    const cart = TestBed.inject(CartStore);
    cart.add({
      productId: '11111111-1111-4111-8111-111111111111',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 4990,
      options: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Borda', priceCents: 800 }],
      notes: '',
    });
    fixture.detectChanges();

    fill(fixture, 'name', 'Ana');
    fill(fixture, 'phone', '11988887777');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');
    fill(fixture, 'line', 'Rua A');
    fill(fixture, 'number', '10');
    fill(fixture, 'district', 'Centro');
    fill(fixture, 'city', 'São Paulo');
    fill(fixture, 'state', 'SP');
    fill(fixture, 'postalCode', '01001000');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');

    flushQuote(http, fixture);
    const review = http.expectOne((call) => call.url.endsWith('/api/v1/public/orders/review'));
    expect(review.request.body.paymentMethodCode).toBe('CASH');
    review.flush({
      items: [
        {
          productName: 'Calabresa',
          quantity: 1,
          notes: null,
          options: [{ name: 'Borda', priceCents: 800 }],
          subtotalCents: 5790,
        },
      ],
      subtotalCents: 5790,
      deliveryFeeCents: 650,
      totalCents: 6440,
      paymentLabel: 'Dinheiro',
      paymentInstructions: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Rua A, 10, Centro, São Paulo');
    expect(fixture.nativeElement.textContent).toContain('Distância aproximada 2,4 km');
    expect(fixture.nativeElement.textContent).toContain('Tempo estimado 40 min');
    expect(fixture.nativeElement.textContent).toContain('Taxa de entrega R$ 6,50');
    expect(fixture.nativeElement.textContent).toContain('Total R$ 64,40');

    const consent = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    consent.click();
    fixture.detectChanges();

    const submit = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fazer pedido'),
    ) as HTMLButtonElement;
    submit.click();
    submit.click();
    fixture.detectChanges();
    const created = http.expectOne((call) => call.url.endsWith('/api/v1/public/orders'));
    expect(created.request.headers.get('Idempotency-Key')).toEqual(expect.any(String));
    expect(created.request.body.consents).toEqual({
      operational: true,
      marketing: false,
      policyVersion: '2026-10-02',
    });
    const key = created.request.headers.get('Idempotency-Key');
    created.flush(
      {
        orderId: 'order-1',
        orderNumber: 7,
        status: 'NEW',
        totalCents: 6440,
        trackingToken: 'token-opaco',
        trackingPath: '/pedido/token-opaco',
      },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    expect(fixture.debugElement.injector.get(CartStore).lines()).toEqual([]);
    expect(key).not.toBeNull();
    http.verify();
  });

  it('reuses the idempotency key and translates a disabled payment method', async () => {
    const fixture = await create();
    const http = TestBed.inject(HttpTestingController);
    flushOpening(http);
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.inject(CartStore).add({
      productId: '11111111-1111-4111-8111-111111111111',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 4990,
      options: [],
      notes: '',
    });
    fixture.detectChanges();
    fill(fixture, 'name', 'Ana');
    fill(fixture, 'phone', '11988887777');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');
    fill(fixture, 'line', 'Rua A');
    fill(fixture, 'number', '10');
    fill(fixture, 'district', 'Centro');
    fill(fixture, 'city', 'São Paulo');
    fill(fixture, 'state', 'sp');
    fill(fixture, 'postalCode', '01001000');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');
    flushQuote(http, fixture);
    http.expectOne((call) => call.url.endsWith('/orders/review')).flush({
      items: [],
      subtotalCents: 4990,
      deliveryFeeCents: 0,
      totalCents: 4990,
      paymentLabel: 'Dinheiro',
      paymentInstructions: null,
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();
    click(fixture, 'Fazer pedido');
    const first = http.expectOne((call) => call.url.endsWith('/api/v1/public/orders'));
    const key = first.request.headers.get('Idempotency-Key');
    first.flush(
      { error: { code: 'PAYMENT_METHOD_DISABLED', message: 'disabled' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Essa forma de pagamento não está disponível.',
    );

    click(fixture, 'Fazer pedido');
    const second = http.expectOne((call) => call.url.endsWith('/api/v1/public/orders'));
    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush(
      {
        orderId: 'order-1',
        orderNumber: 1,
        status: 'NEW',
        totalCents: 4990,
        trackingToken: 'token',
        trackingPath: '/pedido/token',
      },
      { status: 201, statusText: 'Created' },
    );
    http.verify();
  });

  it('disables checkout when the address is outside the delivery area', async () => {
    const fixture = await create();
    const http = TestBed.inject(HttpTestingController);
    flushOpening(http);
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.inject(CartStore).add({
      productId: '11111111-1111-4111-8111-111111111111',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 4990,
      options: [],
      notes: '',
    });
    fixture.detectChanges();
    fill(fixture, 'name', 'Ana');
    fill(fixture, 'phone', '11988887777');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');
    fill(fixture, 'line', 'Rua Longe');
    fill(fixture, 'number', '900');
    fill(fixture, 'district', 'Centro');
    fill(fixture, 'city', 'São Paulo');
    fill(fixture, 'state', 'SP');
    fill(fixture, 'postalCode', '99999999');
    click(fixture, 'Continuar');
    click(fixture, 'Continuar');
    const quote = http.expectOne((call) => call.url.endsWith('/api/v1/public/delivery/quote'));
    quote.flush({
      accepted: false,
      fulfillment: 'DELIVERY',
      distanceKm: 22,
      feeCents: 0,
      estimatedMinutes: 40,
      reason: 'OUT_OF_AREA',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'O endereço está fora da área de entrega.',
    );
    expect(fixture.nativeElement.textContent).toContain('Trocar para retirada');
    const submit = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fazer pedido'),
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    http.expectNone((call) => call.url.endsWith('/orders/review'));
    http.verify();
  });
});

async function create() {
  await TestBed.configureTestingModule({
    imports: [CheckoutPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'pedido/:trackingToken', component: TrackingStub }]),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(CheckoutPage);
  fixture.detectChanges();
  return fixture;
}

function flushQuote(
  http: HttpTestingController,
  fixture: { detectChanges(): void },
): void {
  const quote = http.expectOne((call) => call.url.endsWith('/api/v1/public/delivery/quote'));
  quote.flush({
    accepted: true,
    fulfillment: 'DELIVERY',
    distanceKm: 2.4,
    feeCents: 650,
    estimatedMinutes: 40,
    reason: null,
  });
  fixture.detectChanges();
}

function flushOpening(http: HttpTestingController): void {
  http
    .expectOne((call) => call.url.endsWith('/api/v1/public/store'))
    .flush({
      name: 'Pizzaria',
      phone: '11999999999',
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
  http.expectOne((call) => call.url.endsWith('/api/v1/public/checkout')).flush({
    pickupEnabled: true,
    deliveryEnabled: true,
    paymentMethods: [
      {
        code: 'CASH',
        label: 'Dinheiro',
        instructions: null,
        enabled: true,
        sortOrder: 0,
      },
    ],
  });
}

function fill(
  fixture: { nativeElement: HTMLElement; detectChanges(): void },
  name: string,
  value: string,
): void {
  const input = fixture.nativeElement.querySelector(
    `input`,
  ) as HTMLInputElement | null;
  const match = [...fixture.nativeElement.querySelectorAll('input')].find((element) => {
    const label = element.closest('label')?.textContent ?? '';
    const labels: Record<string, string> = {
      name: 'Nome',
      phone: 'Telefone',
      line: 'Rua',
      number: 'Número',
      district: 'Bairro',
      city: 'Cidade',
      state: 'Estado',
      postalCode: 'CEP',
    };
    return label.includes(labels[name] ?? name);
  }) as HTMLInputElement | undefined;
  const target = match ?? input;
  if (target === null || target === undefined) {
    throw new Error(`Missing input ${name}`);
  }
  target.value = value;
  target.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function click(
  fixture: { nativeElement: HTMLElement; detectChanges(): void },
  label: string,
): void {
  const button = [...fixture.nativeElement.querySelectorAll('button')].find((element) =>
    element.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  if (button === undefined) {
    throw new Error(`Missing button ${label}`);
  }
  button.click();
  fixture.detectChanges();
}
