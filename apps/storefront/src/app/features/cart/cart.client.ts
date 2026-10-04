import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../core/api-url';
import { CartQuote } from './cart';

export interface CartValidateItem {
  productId: string;
  quantity: number;
  optionIds: string[];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CartClient {
  private readonly http = inject(HttpClient);

  validate(host: string, items: readonly CartValidateItem[]): Observable<CartQuote> {
    return this.http.post<CartQuote>(
      apiUrl('/api/v1/public/cart/validate'),
      { items },
      { headers: { 'X-Tenant-Host': host } },
    );
  }
}
