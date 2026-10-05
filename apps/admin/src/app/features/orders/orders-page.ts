import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiUrl } from '../../core/api-url';
import { readErrorCode } from '../../core/api-error';
import { centsToReais } from '../settings/money';

interface AdminOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalCents: number;
  status: string;
  fulfillment: string;
}

interface OrderPage {
  data: AdminOrder[];
  meta: { total: number };
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Pedido realizado',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Em preparação',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

@Component({
  selector: 'admin-orders-page',
  templateUrl: './orders-page.html',
})
export class OrdersPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<AdminOrder[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<OrderPage>(apiUrl('/api/v1/admin/orders'), {
        params: { page: 1, pageSize: 20 },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.orders.set(page.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.orders.set([]);
          this.loading.set(false);
          const code = readErrorCode(error);
          this.error.set(
            code === 'FORBIDDEN'
              ? 'Você não tem permissão para ver os pedidos.'
              : 'Não foi possível carregar os pedidos.',
          );
        },
      });
  }

  format(cents: number): string {
    return `R$ ${centsToReais(cents)}`;
  }

  when(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  status(code: string): string {
    return STATUS_LABELS[code] ?? code;
  }

  fulfillment(code: string): string {
    if (code === 'DELIVERY') {
      return 'Entrega';
    }
    if (code === 'PICKUP') {
      return 'Retirada';
    }
    return code;
  }
}
