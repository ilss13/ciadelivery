import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { applyBrandTheme } from '../../core/brand-theme';
import { PublicStoreClient } from '../../core/public-store.client';
import { formatBrl } from '../../shared/money';
import { CartStore } from '../cart/cart-store';
import {
  CheckoutOptions,
  CreateOrderBody,
  OrderAddressInput,
  OrderClient,
  OrderReview,
  POLICY_VERSION,
} from './order.client';
import { orderErrorMessage } from './order-messages';

type CheckoutStep = 'contact' | 'fulfillment' | 'address' | 'payment' | 'review';

@Component({
  selector: 'storefront-checkout-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './checkout-page.html',
})
export class CheckoutPage implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly stores = inject(PublicStoreClient);
  private readonly orders = inject(OrderClient);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    fulfillment: this.formBuilder.nonNullable.control<'DELIVERY' | 'PICKUP'>('DELIVERY'),
    line: [''],
    number: [''],
    district: [''],
    city: [''],
    state: [''],
    postalCode: [''],
    complement: [''],
    paymentMethodCode: ['', Validators.required],
    operational: [false],
    marketing: [false],
  });

  readonly step = signal<CheckoutStep>('contact');
  readonly loading = signal(true);
  readonly reviewing = signal(false);
  readonly placing = signal(false);
  readonly error = signal('');
  readonly options = signal<CheckoutOptions | null>(null);
  readonly review = signal<OrderReview | null>(null);
  readonly lines = this.cart.lines;

  private host = '';
  private idempotencyKey = '';
  private idempotencyPayload = '';

  ngOnInit(): void {
    this.host = this.document.location.host;
    this.stores
      .load(this.host)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (store) => {
          applyBrandTheme(this.document.documentElement, store.branding);
          this.cart.bind(store.slug);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Não foi possível abrir a loja.');
        },
      });
    this.orders
      .checkout(this.host)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.options.set(options);
          if (!options.deliveryEnabled && options.pickupEnabled) {
            this.form.controls.fulfillment.setValue('PICKUP');
          }
          const first = options.paymentMethods[0];
          if (options.paymentMethods.length === 1 && first !== undefined) {
            this.form.controls.paymentMethodCode.setValue(first.code);
          }
        },
        error: (error: unknown) => {
          this.error.set(orderErrorMessage(error));
        },
      });
  }

  format(cents: number): string {
    return formatBrl(cents);
  }

  continue(): void {
    this.error.set('');
    const current = this.step();
    if (current === 'contact') {
      if (this.form.controls.name.invalid || this.form.controls.phone.invalid) {
        this.form.controls.name.markAsTouched();
        this.form.controls.phone.markAsTouched();
        this.error.set('Informe nome e telefone.');
        return;
      }
      this.step.set('fulfillment');
      return;
    }
    if (current === 'fulfillment') {
      this.step.set(this.form.controls.fulfillment.value === 'DELIVERY' ? 'address' : 'payment');
      return;
    }
    if (current === 'address') {
      if (!this.addressComplete()) {
        this.error.set('Preencha o endereço de entrega.');
        return;
      }
      this.step.set('payment');
      return;
    }
    if (current === 'payment') {
      if (this.form.controls.paymentMethodCode.invalid) {
        this.error.set('Escolha uma forma de pagamento.');
        return;
      }
      this.step.set('review');
      this.loadReview();
    }
  }

  back(): void {
    this.error.set('');
    const current = this.step();
    if (current === 'fulfillment') {
      this.step.set('contact');
      return;
    }
    if (current === 'address') {
      this.step.set('fulfillment');
      return;
    }
    if (current === 'payment') {
      this.step.set(
        this.form.controls.fulfillment.value === 'DELIVERY' ? 'address' : 'fulfillment',
      );
      return;
    }
    if (current === 'review') {
      this.review.set(null);
      this.step.set('payment');
    }
  }

  loadReview(): void {
    this.reviewing.set(true);
    this.error.set('');
    this.review.set(null);
    const fulfillment = this.form.controls.fulfillment.value;
    this.orders
      .review(this.host, {
        fulfillment,
        paymentMethodCode: this.form.controls.paymentMethodCode.value,
        items: this.itemPayload(),
        ...(fulfillment === 'DELIVERY' ? { address: this.addressPayload() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (review) => {
          this.review.set(review);
          this.reviewing.set(false);
        },
        error: (error: unknown) => {
          this.reviewing.set(false);
          this.error.set(orderErrorMessage(error));
        },
      });
  }

  placeOrder(): void {
    if (this.placing() || this.review() === null) {
      return;
    }
    if (!this.form.controls.operational.value) {
      this.error.set('Autorize o uso dos dados para realizar o pedido.');
      return;
    }
    const body = this.orderBody();
    const fingerprint = JSON.stringify(body);
    if (this.idempotencyKey.length === 0 || this.idempotencyPayload !== fingerprint) {
      this.idempotencyKey = crypto.randomUUID();
      this.idempotencyPayload = fingerprint;
    }
    this.placing.set(true);
    this.error.set('');
    this.orders
      .create(this.host, body, this.idempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.cart.clear();
          void this.router.navigate(['/pedido', created.trackingToken]);
        },
        error: (error: unknown) => {
          this.placing.set(false);
          this.error.set(orderErrorMessage(error));
        },
      });
  }

  private orderBody(): CreateOrderBody {
    const fulfillment = this.form.controls.fulfillment.value;
    return {
      customer: {
        name: this.form.controls.name.value.trim(),
        phone: this.form.controls.phone.value.trim(),
      },
      fulfillment,
      ...(fulfillment === 'DELIVERY' ? { address: this.addressPayload() } : {}),
      paymentMethodCode: this.form.controls.paymentMethodCode.value,
      notes: null,
      consents: {
        operational: this.form.controls.operational.value,
        marketing: this.form.controls.marketing.value,
        policyVersion: POLICY_VERSION,
      },
      items: this.itemPayload(),
    };
  }

  private itemPayload(): CreateOrderBody['items'] {
    return this.lines().map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      optionIds: line.options.map((option) => option.id),
      notes: line.notes.trim().length > 0 ? line.notes.trim() : null,
    }));
  }

  private addressPayload(): OrderAddressInput {
    const complement = this.form.controls.complement.value.trim();
    return {
      line: this.form.controls.line.value.trim(),
      number: this.form.controls.number.value.trim(),
      district: this.form.controls.district.value.trim(),
      city: this.form.controls.city.value.trim(),
      state: this.form.controls.state.value.trim().toUpperCase(),
      postalCode: this.form.controls.postalCode.value.trim(),
      complement: complement.length === 0 ? null : complement,
    };
  }

  private addressComplete(): boolean {
    const address = this.addressPayload();
    return (
      address.line.length > 0 &&
      address.number.length > 0 &&
      address.district.length > 0 &&
      address.city.length > 0 &&
      address.state.length === 2 &&
      address.postalCode.length > 0
    );
  }
}
