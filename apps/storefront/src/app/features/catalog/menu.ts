import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatBrl } from '../../shared/money';
import { CartStore } from '../cart/cart-store';
import { CartDraft } from '../cart/cart';
import {
  MenuCategory,
  MenuProduct,
  PublicCatalogClient,
} from './catalog.client';
import { ProductPicker } from './product-picker';

interface MenuSection {
  id: string;
  name: string;
  products: MenuProduct[];
}

@Component({
  selector: 'storefront-menu',
  imports: [ProductPicker],
  templateUrl: './menu.html',
})
export class Menu implements OnInit {
  readonly host = input.required<string>();
  readonly slug = input.required<string>();

  private readonly client = inject(PublicCatalogClient);
  private readonly cart = inject(CartStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<'loading' | 'ready' | 'empty' | 'error'>('loading');
  readonly sections = signal<MenuSection[]>([]);
  readonly opened = signal<MenuProduct | null>(null);

  readonly anchors = computed(() =>
    this.sections().map((section) => ({ id: section.id, name: section.name })),
  );

  ngOnInit(): void {
    this.cart.bind(this.slug());
    this.load();
  }

  load(): void {
    this.status.set('loading');
    this.opened.set(null);
    this.client
      .load(this.host())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (menu) => this.show(menu.categories, menu.products),
        error: () => this.status.set('error'),
      });
  }

  format(cents: number): string {
    return formatBrl(cents);
  }

  add(draft: CartDraft): void {
    this.cart.bind(this.slug());
    this.cart.add(draft);
    this.opened.set(null);
  }

  private show(categories: MenuCategory[], products: MenuProduct[]): void {
    const ordered = [...categories].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
    const sections = ordered
      .map((category) => ({
        id: category.id,
        name: category.name,
        products: products.filter((product) => product.categoryId === category.id),
      }))
      .filter((section) => section.products.length > 0);
    this.sections.set(sections);
    this.status.set(products.length === 0 ? 'empty' : 'ready');
  }
}
