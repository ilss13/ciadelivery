import {
  CartProductSnapshot,
  validateCart,
} from './cart';

function margherita(
  patch: Partial<CartProductSnapshot> = {},
): CartProductSnapshot {
  return {
    id: 'product-1',
    active: true,
    available: true,
    name: 'Margherita',
    priceCents: 3990,
    groups: [
      {
        id: 'size',
        minSelect: 1,
        maxSelect: 1,
        options: [
          {
            id: 'grande',
            groupId: 'size',
            name: 'Grande',
            priceCents: 1000,
            available: true,
          },
        ],
      },
      {
        id: 'extras',
        minSelect: 0,
        maxSelect: 1,
        options: [
          {
            id: 'borda',
            groupId: 'extras',
            name: 'Borda',
            priceCents: 500,
            available: true,
          },
          {
            id: 'catupiry',
            groupId: 'extras',
            name: 'Catupiry',
            priceCents: 700,
            available: true,
          },
        ],
      },
    ],
    ...patch,
  };
}

describe('validateCart', () => {
  it('rejects a missing required group', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: [],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'OPTION_SELECTION_INVALID',
        itemIndex: 0,
      }),
    ]);
    expect(result.subtotalCents).toBe(0);
  });

  it('rejects extras above the group maximum', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande', 'borda', 'catupiry'],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'OPTION_SELECTION_INVALID',
        itemIndex: 0,
      }),
    ]);
  });

  it('rejects an inactive product', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande'],
          notes: null,
        },
      ],
      products: [margherita({ active: false })],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.subtotalCents).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'PRODUCT_NOT_FOUND',
        itemIndex: 0,
      }),
    ]);
  });

  it('prices the line from the catalog snapshot', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 2,
          optionIds: ['grande'],
          notes: 'sem cebola',
        },
      ],
      products: [margherita()],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.items).toEqual([
      {
        itemIndex: 0,
        productId: 'product-1',
        name: 'Margherita',
        quantity: 2,
        unitPriceCents: 3990,
        options: [{ id: 'grande', name: 'Grande', priceCents: 1000 }],
        notes: 'sem cebola',
        subtotalCents: 9980,
      },
    ]);
    expect(result.subtotalCents).toBe(9980);
  });

  it('keeps an option from another product out of the price', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande', 'foreign-option'],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'OPTION_NOT_FOUND', itemIndex: 0 }),
    ]);
    expect(result.subtotalCents).toBe(0);
    expect(result.items[0]?.options).toEqual([
      { id: 'grande', name: 'Grande', priceCents: 1000 },
    ]);
  });

  it('marks a closed store and a subtotal under the minimum', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande'],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 100000,
      storeOpen: false,
    });

    expect(result.storeOpen).toBe(false);
    expect(result.meetsMinimumOrder).toBe(false);
    expect(result.subtotalCents).toBe(4990);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual([
      'STORE_CLOSED',
      'MINIMUM_ORDER_NOT_MET',
    ]);
  });

  it('rejects a closed store even when the subtotal meets the minimum', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande'],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 0,
      storeOpen: false,
    });

    expect(result.valid).toBe(false);
    expect(result.subtotalCents).toBe(4990);
    expect(result.errors).toEqual([
      {
        code: 'STORE_CLOSED',
        itemIndex: null,
        message: 'The store is closed',
      },
    ]);
  });

  it('rejects a subtotal under the configured minimum', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande'],
          notes: null,
        },
      ],
      products: [margherita()],
      minimumOrderCents: 5000,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.meetsMinimumOrder).toBe(false);
    expect(result.subtotalCents).toBe(4990);
    expect(result.errors).toEqual([
      {
        code: 'MINIMUM_ORDER_NOT_MET',
        itemIndex: null,
        message: 'The order is below the minimum',
      },
    ]);
  });

  it('marks a product that is no longer available', () => {
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande'],
          notes: null,
        },
      ],
      products: [margherita({ available: false })],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.subtotalCents).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'PRODUCT_UNAVAILABLE',
        itemIndex: 0,
      }),
    ]);
  });

  it('marks an option that is no longer available', () => {
    const product = margherita();
    const extras = product.groups[1];
    if (extras === undefined) {
      throw new Error('missing extras group');
    }
    const result = validateCart({
      items: [
        {
          productId: 'product-1',
          quantity: 1,
          optionIds: ['grande', 'borda'],
          notes: null,
        },
      ],
      products: [
        {
          ...product,
          groups: [
            product.groups[0] as CartProductSnapshot['groups'][number],
            {
              ...extras,
              options: extras.options.map((option) =>
                option.id === 'borda' ? { ...option, available: false } : option,
              ),
            },
          ],
        },
      ],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'OPTION_UNAVAILABLE', itemIndex: 0 }),
    ]);
    expect(result.items[0]?.options).toEqual([
      { id: 'grande', name: 'Grande', priceCents: 1000 },
    ]);
  });

  it('rejects an empty cart', () => {
    const result = validateCart({
      items: [],
      products: [],
      minimumOrderCents: 0,
      storeOpen: true,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      {
        code: 'CART_EMPTY',
        itemIndex: null,
        message: 'The cart is empty',
      },
    ]);
  });
});
