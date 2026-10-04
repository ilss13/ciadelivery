import { Component, computed, input, output, signal } from '@angular/core';
import { formatBrl } from '../../shared/money';
import { MenuGroup, MenuProduct } from './catalog.client';
import { CartDraft } from '../cart/cart';

@Component({
  selector: 'storefront-product-picker',
  templateUrl: './product-picker.html',
})
export class ProductPicker {
  readonly product = input.required<MenuProduct>();
  readonly added = output<CartDraft>();

  readonly quantity = signal(1);
  readonly notes = signal('');
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly canAdd = computed(() => this.selectionReady(this.product(), this.selected()));

  format(cents: number): string {
    return formatBrl(cents);
  }

  chosen(group: MenuGroup, optionId: string): boolean {
    return this.selected().has(optionId);
  }

  locked(group: MenuGroup, optionId: string): boolean {
    if (group.maxSelect <= 1) {
      return false;
    }
    return (
      this.count(group) >= group.maxSelect && !this.selected().has(optionId)
    );
  }

  choose(group: MenuGroup, optionId: string, checked: boolean): void {
    const option = group.options.find((candidate) => candidate.id === optionId);
    if (option === undefined || !option.available) {
      return;
    }
    const next = new Set(this.selected());
    if (group.maxSelect === 1) {
      for (const candidate of group.options) {
        next.delete(candidate.id);
      }
      if (checked || group.minSelect > 0) {
        next.add(optionId);
      }
    } else if (checked) {
      if (this.count(group) < group.maxSelect) {
        next.add(optionId);
      }
    } else {
      next.delete(optionId);
    }
    this.selected.set(next);
  }

  changeQuantity(value: number): void {
    if (!Number.isInteger(value)) {
      return;
    }
    this.quantity.set(Math.min(99, Math.max(1, value)));
  }

  add(): void {
    const product = this.product();
    if (!product.available || !this.selectionReady(product, this.selected())) {
      return;
    }
    const options = product.optionGroups.flatMap((group) =>
      group.options.filter(
        (option) => option.available && this.selected().has(option.id),
      ),
    );
    this.added.emit({
      productId: product.id,
      name: product.name,
      quantity: this.quantity(),
      unitPriceCents: product.priceCents,
      options: options.map((option) => ({
        id: option.id,
        name: option.name,
        priceCents: option.priceCents,
      })),
      notes: this.notes().trim(),
    });
  }

  private count(group: MenuGroup): number {
    return group.options.filter(
      (option) => option.available && this.selected().has(option.id),
    ).length;
  }

  private selectionReady(
    product: MenuProduct,
    selected: ReadonlySet<string>,
  ): boolean {
    if (!product.available) {
      return false;
    }
    return product.optionGroups.every((group) => {
      const count = group.options.filter(
        (option) => option.available && selected.has(option.id),
      ).length;
      return count >= group.minSelect && count <= group.maxSelect;
    });
  }
}
