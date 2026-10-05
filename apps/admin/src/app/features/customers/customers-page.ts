import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiUrl } from '../../core/api-url';
import { customerErrorMessage } from './customer-messages';

interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
}

interface CustomerAddress {
  id: string;
  label: string | null;
  line: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
}

interface CustomerDetail extends CustomerSummary {
  addresses: CustomerAddress[];
}

interface CustomerPage {
  data: CustomerSummary[];
  meta: { total: number };
}

@Component({
  selector: 'admin-customers-page',
  imports: [ReactiveFormsModule],
  templateUrl: './customers-page.html',
})
export class CustomersPage {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.nonNullable.group({
    phone: ['', Validators.required],
  });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searched = signal(false);
  readonly customers = signal<CustomerSummary[]>([]);
  readonly detail = signal<CustomerDetail | null>(null);

  search(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const phone = this.form.controls.phone.value.trim();
    this.loading.set(true);
    this.error.set('');
    this.detail.set(null);
    this.http
      .get<CustomerPage>(apiUrl('/api/v1/admin/customers'), {
        params: { phone, page: 1, pageSize: 20 },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.searched.set(true);
          this.customers.set(page.data);
          this.loading.set(false);
          const only = page.data[0];
          if (page.data.length === 1 && only !== undefined) {
            this.open(only.id);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.searched.set(true);
          this.customers.set([]);
          this.error.set(customerErrorMessage(error));
        },
      });
  }

  open(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<CustomerDetail>(apiUrl(`/api/v1/admin/customers/${id}`))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => {
          this.detail.set(customer);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(customerErrorMessage(error));
        },
      });
  }

  phoneLabel(phone: string): string {
    if (/^55\d{11}$/.test(phone)) {
      return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    if (/^55\d{10}$/.test(phone)) {
      return `+55 (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  }

  addressLabel(address: CustomerAddress): string {
    const complement =
      address.complement === null ? '' : `, ${address.complement}`;
    const label = address.label === null ? '' : `${address.label}: `;
    return `${label}${address.line}, ${address.number}${complement} — ${address.district}, ${address.city}/${address.state}, ${address.postalCode}`;
  }
}
