import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { OrderCard, OrderRealtimeEvent } from './order-board';
import { OrdersPage } from './orders-page';
import {
  ORDERS_BOARD_STORE,
  OrderBoardMessage,
  OrdersBoardStore,
} from './orders-board.store';

class FakeOrdersBoardStore implements OrdersBoardStore {
  readonly messages = new Subject<OrderBoardMessage>();
  loadResult: OrderCard[] = [];
  readonly fetched = new Map<string, OrderCard>();

  load() {
    return of(this.loadResult);
  }

  watch() {
    return this.messages.asObservable();
  }

  fetch(id: string) {
    const card = this.fetched.get(id);
    if (card === undefined) {
      return throwError(() => new Error('missing'));
    }
    return of(card);
  }

  couriers: { id: string; name: string }[] = [];

  transition() {
    return throwError(() => new Error('unused'));
  }

  listCouriers() {
    return of(this.couriers);
  }

  assign() {
    return throwError(() => new Error('unused'));
  }

  placeTestOrder() {
    return of(card({ source: 'TEST', notes: 'TEST_ORDER' }));
  }
}

describe('OrdersPage', () => {
  let feed: FakeOrdersBoardStore;

  beforeEach(() => {
    localStorage.clear();
    feed = new FakeOrdersBoardStore();
  });

  it('adds a card when order.created arrives', async () => {
    const fixture = await create(feed);
    const created = card();
    feed.fetched.set(created.id, created);
    feed.messages.next({
      kind: 'event',
      event: event('order.created', created),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const news = column(fixture.nativeElement, 'new');
    expect(news.textContent).toContain('Pedido 4');
    expect(news.textContent).toContain('Ana');
    expect(news.textContent).toContain('R$ 56,40');
    expect(news.textContent).toContain('Entrega');
    expect(news.textContent).toMatch(/há \d+ minutos/);
    expect(news.querySelector('.order-card')?.classList.contains('flash')).toBe(
      true,
    );
  });

  it('moves the card when order.accepted arrives', async () => {
    feed.loadResult = [card()];
    const fixture = await create(feed);
    feed.messages.next({
      kind: 'event',
      event: event('order.accepted', card(), 'ACCEPTED'),
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(column(fixture.nativeElement, 'new').textContent).toContain(
      'Nenhum pedido novo',
    );
    expect(column(fixture.nativeElement, 'accepted').textContent).toContain(
      'Pedido 4',
    );
  });

  it('hides accept for the kitchen permission', async () => {
    feed.loadResult = [
      card(),
      card({
        id: 'order-2',
        orderNumber: 5,
        status: 'ACCEPTED',
      }),
    ];
    const fixture = await create(feed);
    TestBed.inject(SessionService).currentUser.set({
      id: 'user-1',
      name: 'Cozinha',
      email: 'cozinha@example.com',
      role: 'KITCHEN',
      permissions: ['orders.read', 'orders.prepare'],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Aceitar');
    expect(text).not.toContain('Cancelar');
    expect(text).toContain('Iniciar preparo');
  });

  it('shows the Teste badge for a test order', async () => {
    feed.loadResult = [card({ source: 'TEST', notes: 'TEST_ORDER' })];
    const fixture = await create(feed);

    expect(column(fixture.nativeElement, 'new').textContent).toContain('Teste');
  });

  it('shows the WhatsApp origin badge', async () => {
    feed.loadResult = [card({ source: 'WHATSAPP' })];
    const fixture = await create(feed);

    expect(column(fixture.nativeElement, 'new').textContent).toContain(
      'WhatsApp',
    );
  });

  it('lets an operator assign a ready delivery and finish one on the route', async () => {
    feed.couriers = [{ id: 'courier-1', name: 'Lia' }];
    feed.loadResult = [
      card({ status: 'READY', fulfillment: 'DELIVERY' }),
      card({
        id: 'order-2',
        orderNumber: 8,
        status: 'OUT_FOR_DELIVERY',
        fulfillment: 'DELIVERY',
      }),
      card({
        id: 'order-3',
        orderNumber: 9,
        status: 'READY',
        fulfillment: 'PICKUP',
      }),
    ];
    const fixture = await create(feed);
    TestBed.inject(SessionService).currentUser.set({
      id: 'user-1',
      name: 'Dono',
      email: 'dono@example.com',
      role: 'OWNER',
      permissions: ['orders.read', 'orders.assign_courier', 'orders.deliver'],
    });
    fixture.detectChanges();

    const ready = column(fixture.nativeElement, 'ready');
    const route = column(fixture.nativeElement, 'delivery');
    expect(ready.textContent).toContain('Atribuir');
    expect(ready.textContent).toContain('Despachar');
    expect(ready.textContent).toContain('Lia');
    expect(ready.textContent).toContain('Marcar retirado');
    expect(route.textContent).toContain('Concluir entrega');
    expect(route.textContent).not.toContain('Atribuir');
  });
});

async function create(feed: FakeOrdersBoardStore) {
  await TestBed.configureTestingModule({
    imports: [OrdersPage],
    providers: [
      provideHttpClient(),
      { provide: ORDERS_BOARD_STORE, useValue: feed },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(OrdersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function column(root: HTMLElement, id: string): HTMLElement {
  const section = root.querySelector(`[data-column="${id}"]`);
  if (!(section instanceof HTMLElement)) {
    throw new Error(`Missing column ${id}`);
  }
  return section;
}

function card(overrides: Partial<OrderCard> = {}): OrderCard {
  return {
    id: 'order-1',
    orderNumber: 4,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    totalCents: 5640,
    status: 'NEW',
    fulfillment: 'DELIVERY',
    customerName: 'Ana Silva',
    source: 'STOREFRONT',
    notes: null,
    ...overrides,
  };
}

function event(
  name: string,
  order: OrderCard,
  status = order.status,
): OrderRealtimeEvent {
  return {
    event: name,
    orderId: order.id,
    status,
    orderNumber: order.orderNumber,
    occurredAt: new Date().toISOString(),
  };
}
