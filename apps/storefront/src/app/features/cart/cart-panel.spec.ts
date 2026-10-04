import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CartPanel } from './cart-panel';
import { CartStore } from './cart-store';

describe('CartPanel', () => {
  let fixture: ComponentFixture<CartPanel>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CartPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(CartPanel);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('host', 'pizzariadoze.localhost');
    fixture.componentRef.setInput('slug', 'pizzariadoze');
    fixture.componentRef.setInput('minimumOrderCents', 0);
  });

  afterEach(() => {
    sessionStorage.clear();
    http.verify();
  });

  it('shows the subtotal of two items', () => {
    fixture.detectChanges();
    const cart = TestBed.inject(CartStore);
    cart.add({
      productId: 'pizza',
      name: 'Margherita',
      quantity: 2,
      unitPriceCents: 1000,
      options: [{ id: 'borda', name: 'Borda', priceCents: 200 }],
      notes: '',
    });
    cart.add({
      productId: 'soda',
      name: 'Refrigerante',
      quantity: 1,
      unitPriceCents: 500,
      options: [],
      notes: '',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Margherita');
    expect(fixture.nativeElement.textContent).toContain('Refrigerante');
    expect(fixture.nativeElement.textContent).toContain('Subtotal R$ 29,00');
  });

  it('shows how much is missing for the minimum order', () => {
    fixture.componentRef.setInput('minimumOrderCents', 5000);
    fixture.detectChanges();
    TestBed.inject(CartStore).add({
      productId: 'pizza',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 1000,
      options: [],
      notes: '',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Faltam R$ 40,00 para o pedido mínimo.',
    );
  });

  it('asks to remove a product that became unavailable', () => {
    fixture.detectChanges();
    const cart = TestBed.inject(CartStore);
    cart.add({
      productId: 'pizza',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 4990,
      options: [],
      notes: '',
    });
    fixture.detectChanges();

    const validateButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Validar carrinho'),
    ) as HTMLButtonElement;
    validateButton.click();
    const request = http.expectOne((call) =>
      call.url.endsWith('/api/v1/public/cart/validate'),
    );
    request.flush({
      items: [
        {
          itemIndex: 0,
          productId: 'pizza',
          name: 'Calabresa',
          quantity: 1,
          unitPriceCents: 4990,
          options: [],
          notes: null,
          subtotalCents: 4990,
        },
      ],
      subtotalCents: 0,
      minimumOrderCents: 0,
      meetsMinimumOrder: true,
      storeOpen: true,
      valid: false,
      errors: [
        {
          code: 'PRODUCT_UNAVAILABLE',
          itemIndex: 0,
          message: 'The product is unavailable',
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Remova-o do carrinho');
  });

  it('keeps confirm from proceeding while the store is closed', () => {
    fixture.componentRef.setInput('storeOpen', false);
    fixture.detectChanges();
    TestBed.inject(CartStore).rememberQuote({
      items: [],
      subtotalCents: 6790,
      minimumOrderCents: 0,
      meetsMinimumOrder: true,
      storeOpen: false,
      valid: false,
      errors: [
        { code: 'STORE_CLOSED', itemIndex: null, message: 'The store is closed' },
      ],
    });
    fixture.detectChanges();

    const confirm = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Confirmar carrinho'),
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('A loja está fechada.');
    confirm.click();
    expect(fixture.nativeElement.textContent).not.toContain('Carrinho válido');
  });
});
