import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { applyBrandTheme } from '../../core/brand-theme';
import { PublicStoreClient } from '../../core/public-store.client';
import { formatBrl } from '../../shared/money';
import { OrderClient, PublicOrder } from '../checkout/order.client';
import { formatWhen, fulfillmentLabel, statusLabel } from '../checkout/order-labels';
import { orderErrorMessage } from '../checkout/order-messages';

@Component({
  selector: 'storefront-tracking-page',
  imports: [RouterLink],
  templateUrl: './tracking-page.html',
})
export class TrackingPage implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly stores = inject(PublicStoreClient);
  private readonly orders = inject(OrderClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<PublicOrder | null>(null);

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('trackingToken') ?? '';
    this.stores
      .load(this.document.location.host)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (store) => {
          applyBrandTheme(this.document.documentElement, store.branding);
        },
      });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.orders
      .load(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.order.set(null);
          this.loading.set(false);
          this.error.set(orderErrorMessage(error));
        },
      });
  }

  format(cents: number): string {
    return formatBrl(cents);
  }

  status(code: string): string {
    return statusLabel(code);
  }

  fulfillment(code: string): string {
    return fulfillmentLabel(code);
  }

  when(value: string): string {
    return formatWhen(value);
  }
}
