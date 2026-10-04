export interface CartRequestItem {
  productId: string;
  quantity: number;
  optionIds: readonly string[];
  notes: string | null;
}

export interface CartOptionSnapshot {
  id: string;
  groupId: string;
  name: string;
  priceCents: number;
  available: boolean;
}

export interface CartGroupSnapshot {
  id: string;
  minSelect: number;
  maxSelect: number;
  options: readonly CartOptionSnapshot[];
}

export interface CartProductSnapshot {
  id: string;
  active: boolean;
  available: boolean;
  name: string;
  priceCents: number;
  groups: readonly CartGroupSnapshot[];
}

export interface PricedCartOption {
  id: string;
  name: string;
  priceCents: number;
}

export interface PricedCartItem {
  itemIndex: number;
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  options: PricedCartOption[];
  notes: string | null;
  subtotalCents: number;
}

export interface CartError {
  code: string;
  itemIndex: number | null;
  message: string;
}

export interface CartValidation {
  items: PricedCartItem[];
  subtotalCents: number;
  minimumOrderCents: number;
  meetsMinimumOrder: boolean;
  storeOpen: boolean;
  valid: boolean;
  errors: CartError[];
}

const NOTE_LIMIT = 280;

export function validateCart(input: {
  items: readonly CartRequestItem[];
  products: readonly CartProductSnapshot[];
  minimumOrderCents: number;
  storeOpen: boolean;
}): CartValidation {
  const errors: CartError[] = [];
  const items: PricedCartItem[] = [];
  const countable = new Set<number>();

  if (input.items.length === 0) {
    errors.push({
      code: 'CART_EMPTY',
      itemIndex: null,
      message: 'The cart is empty',
    });
  }

  input.items.forEach((request, index) => {
    const outcome = validateItem(request, index, input.products);
    errors.push(...outcome.errors);
    if (outcome.priced !== null) {
      items.push(outcome.priced);
      if (outcome.errors.length === 0) {
        countable.add(index);
      }
    }
  });

  const subtotalCents = items
    .filter((item) => countable.has(item.itemIndex))
    .reduce((sum, item) => sum + item.subtotalCents, 0);
  const meetsMinimumOrder = subtotalCents >= input.minimumOrderCents;

  if (input.items.length > 0 && !input.storeOpen) {
    errors.push({
      code: 'STORE_CLOSED',
      itemIndex: null,
      message: 'The store is closed',
    });
  }
  if (input.items.length > 0 && !meetsMinimumOrder) {
    errors.push({
      code: 'MINIMUM_ORDER_NOT_MET',
      itemIndex: null,
      message: 'The order is below the minimum',
    });
  }

  return {
    items,
    subtotalCents,
    minimumOrderCents: input.minimumOrderCents,
    meetsMinimumOrder,
    storeOpen: input.storeOpen,
    valid: errors.length === 0,
    errors,
  };
}

function validateItem(
  request: CartRequestItem,
  index: number,
  products: readonly CartProductSnapshot[],
): { errors: CartError[]; priced: PricedCartItem | null } {
  const errors: CartError[] = [];
  if (
    !Number.isInteger(request.quantity) ||
    request.quantity < 1 ||
    request.quantity > 99
  ) {
    errors.push({
      code: 'INVALID_QUANTITY',
      itemIndex: index,
      message: 'The quantity must be an integer from 1 to 99',
    });
  }

  const notes = readNotes(request.notes);
  if (notes === undefined) {
    errors.push({
      code: 'NOTES_TOO_LONG',
      itemIndex: index,
      message: 'The note must be at most 280 characters',
    });
  }

  const product = products.find((candidate) => candidate.id === request.productId);
  if (product === undefined || !product.active) {
    errors.push({
      code: 'PRODUCT_NOT_FOUND',
      itemIndex: index,
      message: 'The product was not found',
    });
    return { errors, priced: null };
  }

  if (!product.available) {
    errors.push({
      code: 'PRODUCT_UNAVAILABLE',
      itemIndex: index,
      message: 'The product is unavailable',
    });
  }

  const optionsById = new Map(
    product.groups.flatMap((group) =>
      group.options.map((option) => [option.id, option] as const),
    ),
  );
  const chosen: CartOptionSnapshot[] = [];
  const seen = new Set<string>();
  for (const optionId of request.optionIds) {
    if (seen.has(optionId)) {
      errors.push({
        code: 'OPTION_SELECTION_INVALID',
        itemIndex: index,
        message: 'The same option was selected more than once',
      });
      continue;
    }
    seen.add(optionId);
    const option = optionsById.get(optionId);
    if (option === undefined) {
      errors.push({
        code: 'OPTION_NOT_FOUND',
        itemIndex: index,
        message: 'The option was not found',
      });
      continue;
    }
    if (!option.available) {
      errors.push({
        code: 'OPTION_UNAVAILABLE',
        itemIndex: index,
        message: 'The option is unavailable',
      });
      continue;
    }
    chosen.push(option);
  }

  for (const group of product.groups) {
    const count = chosen.filter((option) => option.groupId === group.id).length;
    if (count < group.minSelect || count > group.maxSelect) {
      errors.push({
        code: 'OPTION_SELECTION_INVALID',
        itemIndex: index,
        message: 'The option selection is invalid',
      });
    }
  }

  if (!Number.isInteger(request.quantity) || request.quantity < 1) {
    return { errors, priced: null };
  }

  const extras = chosen.reduce((sum, option) => sum + option.priceCents, 0);
  return {
    errors,
    priced: {
      itemIndex: index,
      productId: product.id,
      name: product.name,
      quantity: request.quantity,
      unitPriceCents: product.priceCents,
      options: chosen.map((option) => ({
        id: option.id,
        name: option.name,
        priceCents: option.priceCents,
      })),
      notes: notes ?? null,
      subtotalCents: (product.priceCents + extras) * request.quantity,
    },
  };
}

function readNotes(notes: string | null): string | null | undefined {
  if (notes === null) {
    return null;
  }
  const trimmed = notes.trim();
  if (trimmed.length > NOTE_LIMIT) {
    return undefined;
  }
  return trimmed.length === 0 ? null : trimmed;
}
