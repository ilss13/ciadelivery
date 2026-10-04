import { Component, computed, inject, input, signal } from '@angular/core';
import { cartSubtotal } from '../cart/cart';
import { CartPanel } from '../cart/cart-panel';
import { CartStore } from '../cart/cart-store';
import { formatBrl } from '../../shared/money';
import { Menu } from './menu';

@Component({
  selector: 'storefront-ordering',
  imports: [Menu, CartPanel],
  templateUrl: './ordering.html',
})
export class Ordering {
  readonly host = input.required<string>();
  readonly slug = input.required<string>();
  readonly minimumOrderCents = input(0);
  readonly storeOpen = input(true);

  private readonly cart = inject(CartStore);
  readonly cartOpen = signal(false);
  readonly count = computed(() =>
    this.cart.lines().reduce((sum, line) => sum + line.quantity, 0),
  );
  readonly subtotal = computed(() => cartSubtotal(this.cart.lines()));

  format(cents: number): string {
    return formatBrl(cents);
  }
}
