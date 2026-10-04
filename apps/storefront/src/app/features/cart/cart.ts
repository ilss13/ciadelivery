export interface CartOption {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartLine {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  options: CartOption[];
  notes: string;
}

export interface CartDraft {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  options: CartOption[];
  notes: string;
}

export interface QuotedOption {
  id: string;
  name: string;
  priceCents: number;
}

export interface QuotedItem {
  itemIndex: number;
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  options: QuotedOption[];
  notes: string | null;
  subtotalCents: number;
}

export interface CartIssue {
  code: string;
  itemIndex: number | null;
  message: string;
}

export interface CartQuote {
  items: QuotedItem[];
  subtotalCents: number;
  minimumOrderCents: number;
  meetsMinimumOrder: boolean;
  storeOpen: boolean;
  valid: boolean;
  errors: CartIssue[];
}

export function lineSubtotal(line: CartLine): number {
  const extras = line.options.reduce((sum, option) => sum + option.priceCents, 0);
  return (line.unitPriceCents + extras) * line.quantity;
}

export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineSubtotal(line), 0);
}

export function cartStorageKey(slug: string): string {
  return `ciadelivery.cart.${slug}`;
}

export function readCart(slug: string): CartLine[] {
  const storage = browserStorage();
  if (storage === null) {
    return [];
  }
  const raw = storage.getItem(cartStorageKey(slug));
  if (raw === null) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

export function writeCart(slug: string, lines: readonly CartLine[]): void {
  const storage = browserStorage();
  if (storage === null) {
    return;
  }
  storage.setItem(cartStorageKey(slug), JSON.stringify(lines));
}

function browserStorage(): Storage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const line = value as Partial<CartLine>;
  return (
    typeof line.lineId === 'string' &&
    typeof line.productId === 'string' &&
    typeof line.name === 'string' &&
    typeof line.quantity === 'number' &&
    typeof line.unitPriceCents === 'number' &&
    typeof line.notes === 'string' &&
    Array.isArray(line.options)
  );
}
