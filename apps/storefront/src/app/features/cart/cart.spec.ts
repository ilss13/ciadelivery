import { CartLine, readCart, writeCart } from './cart';
import { CartStore } from './cart-store';

function line(name: string): CartLine {
  return {
    lineId: 'line-1',
    productId: 'product-1',
    name,
    quantity: 1,
    unitPriceCents: 4990,
    options: [{ id: 'borda', name: 'Borda', priceCents: 800 }],
    notes: '',
  };
}

describe('cart storage by slug', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('does not reuse a cart saved for another store', () => {
    writeCart('pizzariadoze', [line('Calabresa')]);

    expect(readCart('burgercentral')).toEqual([]);
    expect(readCart('pizzariadoze')).toEqual([line('Calabresa')]);
  });

  it('drops the previous quote when the slug changes', () => {
    const store = new CartStore();
    store.bind('pizzariadoze');
    store.add({
      productId: 'product-1',
      name: 'Calabresa',
      quantity: 1,
      unitPriceCents: 4990,
      options: [{ id: 'borda', name: 'Borda', priceCents: 800 }],
      notes: '',
    });
    store.rememberQuote({
      items: [],
      subtotalCents: 6790,
      minimumOrderCents: 0,
      meetsMinimumOrder: true,
      storeOpen: true,
      valid: true,
      errors: [],
    });

    store.bind('burgercentral');

    expect(store.lines()).toEqual([]);
    expect(store.quote()).toBeNull();
    expect(readCart('pizzariadoze')).toHaveLength(1);
  });
});
