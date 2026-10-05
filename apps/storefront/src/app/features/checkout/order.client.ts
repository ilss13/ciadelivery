import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/api-url';

export const POLICY_VERSION = '2026-10-02';

export interface CheckoutPaymentMethod {
  code: string;
  label: string;
  instructions: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface CheckoutOptions {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  paymentMethods: CheckoutPaymentMethod[];
}

export interface OrderAddressInput {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
  optionIds: string[];
  notes: string | null;
}

export interface OrderReview {
  items: Array<{
    productName: string;
    quantity: number;
    notes: string | null;
    options: Array<{ name: string; priceCents: number }>;
    subtotalCents: number;
  }>;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentLabel: string;
  paymentInstructions: string | null;
}

export interface CreateOrderBody {
  customer: { name: string; phone: string };
  fulfillment: 'DELIVERY' | 'PICKUP';
  address?: OrderAddressInput;
  paymentMethodCode: string;
  notes: null;
  consents: {
    operational: boolean;
    marketing: boolean;
    policyVersion: string;
  };
  items: OrderItemInput[];
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  trackingToken: string;
  trackingPath: string;
}

export interface PublicOrder {
  orderId: string;
  orderNumber: number;
  status: string;
  fulfillment: string;
  paymentLabel: string;
  paymentInstructions: string | null;
  customerName: string;
  address: OrderAddressInput | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    notes: string | null;
    options: Array<{ name: string }>;
    subtotalCents: number;
  }>;
  history: Array<{
    toStatus: string;
    createdAt: string;
    note?: string | null;
    actorType?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class OrderClient {
  private readonly http = inject(HttpClient);

  checkout(host: string): Observable<CheckoutOptions> {
    return this.http.get<CheckoutOptions>(apiUrl('/api/v1/public/checkout'), {
      headers: { 'X-Tenant-Host': host },
    });
  }

  review(
    host: string,
    body: {
      fulfillment: 'DELIVERY' | 'PICKUP';
      address?: OrderAddressInput;
      paymentMethodCode: string;
      items: OrderItemInput[];
    },
  ): Observable<OrderReview> {
    return this.http.post<OrderReview>(apiUrl('/api/v1/public/orders/review'), body, {
      headers: { 'X-Tenant-Host': host },
    });
  }

  create(
    host: string,
    body: CreateOrderBody,
    idempotencyKey: string,
  ): Observable<CreatedOrder> {
    return this.http.post<CreatedOrder>(apiUrl('/api/v1/public/orders'), body, {
      headers: {
        'X-Tenant-Host': host,
        'Idempotency-Key': idempotencyKey,
      },
    });
  }

  load(trackingToken: string): Observable<PublicOrder> {
    return this.http.get<PublicOrder>(
      apiUrl(`/api/v1/public/orders/${encodeURIComponent(trackingToken)}`),
    );
  }
}
