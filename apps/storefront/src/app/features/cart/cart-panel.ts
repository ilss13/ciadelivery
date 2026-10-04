import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatBrl } from '../../shared/money';
import { cartSubtotal, lineSubtotal } from './cart';
import { CartClient } from './cart.client';
import { cartErrorMessage, minimumOrderShortfallMessage } from './cart-messages';
import { CartStore } from './cart-store';

@Component({
  selector: 'storefront-cart-panel',
  templateUrl: './cart-panel.html',
})
export class CartPanel implements OnInit {
  readonly host = input.required<string>();
  readonly slug = input.required<string>();
  readonly minimumOrderCents = input(0);
  readonly storeOpen = input(true);

  private readonly cart = inject(CartStore);
  private readonly client = inject(CartClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly lines = this.cart.lines;
  readonly quote = this.cart.quote;
  readonly validating = signal(false);
  readonly networkError = signal(false);
  readonly subtotalCents = computed(() => {
    const quote = this.quote();
    return quote === null ? cartSubtotal(this.lines()) : quote.subtotalCents;
  });
  readonly shortfallCents = computed(() => {
    const minimum = this.quote()?.minimumOrderCents ?? this.minimumOrderCents();
    return Math.max(0, minimum - this.subtotalCents());
  });
  readonly canConfirm = computed(
    () => this.storeOpen() && this.quote()?.valid === true && !this.validating(),
  );

  ngOnInit(): void {
    this.cart.bind(this.slug());
  }

  format(cents: number): string {
    return formatBrl(cents);
  }

  lineTotal(lineId: string): number {
    const line = this.lines().find((candidate) => candidate.lineId === lineId);
    return line === undefined ? 0 : lineSubtotal(line);
  }

  lineErrors(index: number): string[] {
    const quote = this.quote();
    if (quote === null) {
      return [];
    }
    return [
      ...new Set(
        quote.errors
          .filter((error) => error.itemIndex === index)
          .map((error) => cartErrorMessage(error.code)),
      ),
    ];
  }

  summaryErrors(): string[] {
    const quote = this.quote();
    if (quote === null) {
      return [];
    }
    return [
      ...new Set(
        quote.errors
          .filter((error) => error.itemIndex === null)
          .map((error) => this.describe(error.code)),
      ),
    ];
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
  }

  setQuantity(lineId: string, quantity: number): void {
    this.networkError.set(false);
    this.cart.setQuantity(lineId, quantity);
  }

  remove(lineId: string): void {
    this.networkError.set(false);
    this.cart.remove(lineId);
  }

  validate(): void {
    this.cart.bind(this.slug());
    this.validating.set(true);
    this.networkError.set(false);
    this.client
      .validate(
        this.host(),
        this.lines().map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          optionIds: line.options.map((option) => option.id),
          ...(line.notes.length > 0 ? { notes: line.notes } : {}),
        })),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quote) => {
          this.cart.rememberQuote(quote);
          this.validating.set(false);
        },
        error: () => {
          this.networkError.set(true);
          this.validating.set(false);
        },
      });
  }

  private describe(code: string): string {
    if (code === 'MINIMUM_ORDER_NOT_MET' && this.shortfallCents() > 0) {
      return minimumOrderShortfallMessage(this.shortfallCents());
    }
    return cartErrorMessage(code);
  }
}
