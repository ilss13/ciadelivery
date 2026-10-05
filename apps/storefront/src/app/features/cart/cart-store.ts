import { Injectable, signal } from '@angular/core';
import {
  CartDraft,
  CartLine,
  CartQuote,
  readCart,
  writeCart,
} from './cart';

@Injectable({ providedIn: 'root' })
export class CartStore {
  readonly lines = signal<CartLine[]>([]);
  readonly quote = signal<CartQuote | null>(null);
  private slug = '';

  bind(slug: string): void {
    if (this.slug === slug) {
      return;
    }
    this.slug = slug;
    this.lines.set(readCart(slug));
    this.quote.set(null);
  }

  add(draft: CartDraft): void {
    const notes = draft.notes.trim();
    const signature = optionSignature(draft.options.map((option) => option.id));
    const lines = this.lines().map((line) => ({ ...line, options: [...line.options] }));
    const existing = lines.find(
      (line) =>
        line.productId === draft.productId &&
        line.notes === notes &&
        optionSignature(line.options.map((option) => option.id)) === signature,
    );
    const quantity = clampQuantity(draft.quantity);
    if (existing === undefined) {
      lines.push({
        lineId: crypto.randomUUID(),
        productId: draft.productId,
        name: draft.name,
        quantity,
        unitPriceCents: draft.unitPriceCents,
        options: draft.options,
        notes,
      });
    } else {
      existing.quantity = Math.min(99, existing.quantity + quantity);
    }
    this.replace(lines);
  }

  setQuantity(lineId: string, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1) {
      this.remove(lineId);
      return;
    }
    this.replace(
      this.lines().map((line) =>
        line.lineId === lineId
          ? { ...line, quantity: Math.min(99, quantity) }
          : line,
      ),
    );
  }

  remove(lineId: string): void {
    this.replace(this.lines().filter((line) => line.lineId !== lineId));
  }

  clear(): void {
    this.replace([]);
  }

  rememberQuote(quote: CartQuote): void {
    const next = this.lines().map((line, index) => {
      const priced = quote.items.find((item) => item.itemIndex === index);
      if (priced === undefined) {
        return line;
      }
      return {
        ...line,
        name: priced.name,
        unitPriceCents: priced.unitPriceCents,
        quantity: priced.quantity,
        options: priced.options,
        notes: priced.notes ?? '',
      };
    });
    this.lines.set(next);
    this.persist(next);
    this.quote.set(quote);
  }

  private replace(lines: CartLine[]): void {
    this.lines.set(lines);
    this.persist(lines);
    this.quote.set(null);
  }

  private persist(lines: readonly CartLine[]): void {
    if (this.slug.length === 0) {
      return;
    }
    writeCart(this.slug, lines);
  }
}

function optionSignature(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

function clampQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return 1;
  }
  return Math.min(99, quantity);
}
