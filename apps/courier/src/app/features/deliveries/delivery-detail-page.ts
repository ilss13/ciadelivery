import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { readErrorCode } from '../../core/api-error';
import { COURIER_BOARD } from './courier-board';
import { CourierOrder, formatAddress, formatCents } from './courier-order';

@Component({
  selector: 'courier-delivery-detail-page',
  imports: [RouterLink],
  host: { class: 'stack' },
  templateUrl: './delivery-detail-page.html',
})
export class DeliveryDetailPage implements OnInit {
  private readonly board = inject(COURIER_BOARD);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<CourierOrder | null>(null);
  readonly busy = signal(false);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) =>
          this.board.fetch(params.get('id') ?? '').pipe(
            catchError((error: unknown) => {
              this.error.set(message(readErrorCode(error)));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((order) => {
        this.loading.set(false);
        this.order.set(order);
      });
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

  address(order: CourierOrder): string {
    return formatAddress(order.address);
  }

  money(cents: number): string {
    return formatCents(cents);
  }

  start(): void {
    this.run('start');
  }

  complete(): void {
    this.run('complete');
  }

  private run(action: 'start' | 'complete'): void {
    const current = this.order();
    if (current === null) {
      return;
    }
    if (!this.online()) {
      this.error.set('Sem conexão. A entrega não foi marcada.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const request =
      action === 'start' ? this.board.start(current.id) : this.board.complete(current.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => {
        this.order.set(order);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        if (!this.online()) {
          this.error.set('Sem conexão. A entrega não foi marcada.');
          return;
        }
        this.error.set(message(readErrorCode(error)));
      },
    });
  }
}

function message(code: string): string {
  if (code === 'ORDER_NOT_FOUND') {
    return 'Entrega não encontrada.';
  }
  if (code === 'ORDER_INVALID_TRANSITION') {
    return 'Essa ação não é permitida neste status.';
  }
  return 'Não foi possível atualizar a entrega.';
}
