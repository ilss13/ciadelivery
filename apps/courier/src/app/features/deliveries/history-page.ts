import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { COURIER_BOARD } from './courier-board';
import { CourierOrder, formatAddress, formatCents } from './courier-order';

@Component({
  selector: 'courier-history-page',
  imports: [RouterLink],
  host: { class: 'stack' },
  templateUrl: './history-page.html',
})
export class HistoryPage implements OnInit {
  private readonly board = inject(COURIER_BOARD);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<CourierOrder[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(0);

  ngOnInit(): void {
    this.load(1);
  }

  address(order: CourierOrder): string {
    return formatAddress(order.address);
  }

  money(cents: number): string {
    return formatCents(cents);
  }

  next(): void {
    if (this.page() < this.totalPages()) {
      this.load(this.page() + 1);
    }
  }

  previous(): void {
    if (this.page() > 1) {
      this.load(this.page() - 1);
    }
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    this.board
      .history(page)
      .pipe(
        catchError(() => {
          this.error.set('Não foi possível carregar o histórico.');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result === null) {
          return;
        }
        this.orders.set(result.data);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
      });
  }
}
