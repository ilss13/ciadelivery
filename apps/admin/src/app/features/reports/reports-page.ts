import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { apiUrl } from '../../core/api-url';
import { centsToReais } from '../settings/money';
import {
  periodPreset,
  reportsErrorMessage,
  sourceLabel,
  statusLabel,
} from './reports-messages';

interface Overview {
  orderCount: number;
  revenueCents: number;
  averageTicketCents: number;
  cancelledCount: number;
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
}

interface ProductRow {
  productId: string | null;
  productName: string;
  quantity: number;
  subtotalCents: number;
}

interface CustomerRow {
  customerId: string;
  name: string;
  maskedPhone: string;
  orderCount: number;
}

interface CourierRow {
  courierId: string;
  name: string;
  deliveredCount: number;
}

@Component({
  selector: 'admin-reports-page',
  imports: [ReactiveFormsModule],
  templateUrl: './reports-page.html',
})
export class ReportsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.nonNullable.group(periodPreset('7'));
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly loaded = signal(false);
  readonly overview = signal<Overview | null>(null);
  readonly products = signal<ProductRow[]>([]);
  readonly customers = signal<CustomerRow[]>([]);
  readonly couriers = signal<CourierRow[]>([]);

  ngOnInit(): void {
    this.load();
  }

  search(): void {
    this.load();
  }

  preset(kind: 'today' | '7' | '30'): void {
    this.form.setValue(periodPreset(kind));
    this.load();
  }

  reais(cents: number): string {
    return `R$ ${centsToReais(cents)}`;
  }

  status(value: string): string {
    return statusLabel(value);
  }

  source(value: string): string {
    return sourceLabel(value);
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.error.set('');
    this.http
      .get(apiUrl('/api/v1/admin/reports/orders.csv'), {
        params: this.params(),
        responseType: 'blob',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.exporting.set(false);
          saveCsv(blob);
        },
        error: (error: unknown) => {
          this.exporting.set(false);
          this.error.set(reportsErrorMessage(error));
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = this.params();
    forkJoin({
      overview: this.http.get<Overview>(apiUrl('/api/v1/admin/reports/overview'), {
        params,
      }),
      products: this.http.get<ProductRow[]>(apiUrl('/api/v1/admin/reports/products'), {
        params,
      }),
      customers: this.http.get<CustomerRow[]>(
        apiUrl('/api/v1/admin/reports/customers'),
        { params },
      ),
      couriers: this.http.get<CourierRow[]>(apiUrl('/api/v1/admin/reports/couriers'), {
        params,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.overview.set(body.overview);
          this.products.set(body.products);
          this.customers.set(body.customers);
          this.couriers.set(body.couriers);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.overview.set(null);
          this.products.set([]);
          this.customers.set([]);
          this.couriers.set([]);
          this.loaded.set(true);
          this.loading.set(false);
          this.error.set(reportsErrorMessage(error));
        },
      });
  }

  private params(): HttpParams {
    const filters = this.form.getRawValue();
    return new HttpParams().set('from', filters.from).set('to', filters.to);
  }
}

function saveCsv(blob: Blob): void {
  const create = URL.createObjectURL?.bind(URL);
  const revoke = URL.revokeObjectURL?.bind(URL);
  if (create === undefined) {
    return;
  }
  const url = create(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'pedidos.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  revoke?.(url);
}
