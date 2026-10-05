import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { readErrorCode } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { COURIER_BOARD } from './courier-board';
import {
  CourierOrder,
  CourierRealtimeEvent,
  applyCourierEvent,
  formatAddress,
  formatCents,
} from './courier-order';

@Component({
  selector: 'courier-deliveries-page',
  imports: [RouterLink],
  host: { class: 'stack' },
  templateUrl: './deliveries-page.html',
})
export class DeliveriesPage implements OnInit {
  private readonly board = inject(COURIER_BOARD);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.session.currentUser;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<CourierOrder[]>([]);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  ngOnInit(): void {
    if (this.user()?.role !== 'COURIER') {
      this.loading.set(false);
      return;
    }
    this.board
      .watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        if (message.kind === 'resync') {
          this.reload();
          return;
        }
        this.onEvent(message.event);
      });
    this.reload();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.online.set(true);
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.online.set(false);
    this.error.set('Sem conexão. A entrega não foi marcada.');
  }

  reload(): void {
    this.loading.set(this.orders().length === 0);
    this.board
      .loadActive()
      .pipe(
        catchError((error: unknown) => {
          this.error.set(loadMessage(readErrorCode(error)));
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((orders) => {
        this.loading.set(false);
        if (orders !== null) {
          this.orders.set(orders);
          if (this.online()) {
            this.error.set('');
          }
        }
      });
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/login');
  }

  address(order: CourierOrder): string {
    return formatAddress(order.address);
  }

  money(cents: number): string {
    return formatCents(cents);
  }

  statusLabel(status: string): string {
    if (status === 'OUT_FOR_DELIVERY') {
      return 'Em rota';
    }
    if (status === 'READY') {
      return 'Atribuído';
    }
    return status;
  }

  private onEvent(event: CourierRealtimeEvent): void {
    if (event.event !== 'order.courier_assigned') {
      this.orders.set(applyCourierEvent(this.orders(), event, null));
      return;
    }
    if (this.orders().some((order) => order.id === event.orderId)) {
      this.orders.set(applyCourierEvent(this.orders(), event, null));
      return;
    }
    this.board
      .fetch(event.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          this.orders.set(applyCourierEvent(this.orders(), event, order));
        },
        error: () => {
          this.error.set('Não foi possível carregar a entrega.');
        },
      });
  }
}

function loadMessage(code: string): string {
  if (code === 'FORBIDDEN') {
    return 'Você não tem permissão para ver as entregas.';
  }
  return 'Não foi possível carregar as entregas.';
}
