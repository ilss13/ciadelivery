import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { SessionService } from '../../core/session.service';
import {
  COURIER_BOARD,
  CourierBoard,
  CourierBoardMessage,
} from './courier-board';
import { CourierOrder } from './courier-order';
import { DeliveriesPage } from './deliveries-page';

class FakeCourierBoard implements CourierBoard {
  active: CourierOrder[] = [];
  readonly fetched = new Map<string, CourierOrder>();
  readonly messages = new Subject<CourierBoardMessage>();

  loadActive() {
    return of(this.active);
  }

  fetch(id: string) {
    const order = this.fetched.get(id);
    if (order === undefined) {
      return throwError(() => new Error('missing'));
    }
    return of(order);
  }

  start() {
    return throwError(() => new Error('unused'));
  }

  complete() {
    return throwError(() => new Error('unused'));
  }

  history() {
    return of({ data: [], page: 1, totalPages: 0 });
  }

  watch() {
    return this.messages.asObservable();
  }
}

describe('DeliveriesPage', () => {
  let board: FakeCourierBoard;

  beforeEach(() => {
    board = new FakeCourierBoard();
  });

  it('shows the courier access message for other roles', async () => {
    const fixture = await create(board, 'OWNER');
    expect(fixture.nativeElement.textContent).toContain(
      'Esta entrada é só para quem faz as entregas.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Pedido 7');
  });

  it('renders only the orders returned by the api', async () => {
    board.active = [order(7, 'READY'), order(8, 'OUT_FOR_DELIVERY')];
    const fixture = await create(board, 'COURIER');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pedido 7');
    expect(text).toContain('Pedido 8');
    expect(text).toContain('Atribuído');
    expect(text).toContain('Em rota');
    expect(text).toContain('Rua A, 10');
    expect(text).not.toContain('Pedido 9');
  });

  it('adds a card when an assignment arrives', async () => {
    const fixture = await create(board, 'COURIER');
    const created = order(9, 'READY');
    board.fetched.set(created.id, created);
    board.messages.next({
      kind: 'event',
      event: {
        event: 'order.courier_assigned',
        orderId: created.id,
        status: 'READY',
        orderNumber: 9,
        occurredAt: new Date().toISOString(),
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pedido 9');
  });
});

async function create(
  board: FakeCourierBoard,
  role: string,
): Promise<ComponentFixture<DeliveriesPage>> {
  await TestBed.configureTestingModule({
    imports: [DeliveriesPage],
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: COURIER_BOARD, useValue: board },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DeliveriesPage);
  TestBed.inject(SessionService).currentUser.set({
    id: '1',
    name: 'Lia',
    role,
  });
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function order(orderNumber: number, status: string): CourierOrder {
  return {
    id: `order-${orderNumber}`,
    orderNumber,
    status,
    totalCents: 1500,
    address: {
      line: 'Rua A',
      number: '10',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
      complement: null,
    },
  };
}
