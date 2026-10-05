import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, interval, map, of, switchMap } from 'rxjs';
import { readErrorCode } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { centsToReais } from '../settings/money';
import {
  OrderAlert,
  readSoundPreference,
  writeSoundPreference,
} from './order-alert';
import {
  BOARD_COLUMNS,
  OrderCard,
  OrderRealtimeEvent,
  ageLabel,
  applyOrderEvent,
  firstName,
  mergeBoard,
  placeCard,
} from './order-board';
import {
  ORDERS_BOARD_STORE,
  CourierOption,
  OrderAction,
  OrderBoardMessage,
} from './orders-board.store';

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: 'Entregue',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

@Component({
  selector: 'admin-orders-page',
  templateUrl: './orders-page.html',
})
export class OrdersPage implements OnInit {
  private readonly feed = inject(ORDERS_BOARD_STORE);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly alert = new OrderAlert();
  private readonly reload$ = new Subject<void>();
  private readonly pending = new Set<string>();
  private readonly flashTimers: number[] = [];

  readonly columns = BOARD_COLUMNS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<OrderCard[]>([]);
  readonly now = signal(Date.now());
  readonly highlighted = signal<ReadonlySet<string>>(new Set());
  readonly announcement = signal('');
  readonly soundEnabled = signal(readSoundPreference());
  readonly soundBlocked = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly noteFor = signal<{ id: string; action: 'reject' | 'cancel' } | null>(
    null,
  );
  readonly note = signal('');
  readonly actionError = signal('');
  readonly actionErrorId = signal<string | null>(null);
  readonly couriers = signal<CourierOption[]>([]);
  readonly courierChoice = signal<Record<string, string>>({});

  constructor() {
    this.reload$
      .pipe(
        switchMap(() => {
          if (this.orders().length === 0) {
            this.loading.set(true);
          }
          this.error.set('');
          return this.feed.load().pipe(
            map((orders) => ({ ok: true as const, orders })),
            catchError((error: unknown) => of({ ok: false as const, error })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result.ok) {
          this.error.set(loadMessage(readErrorCode(result.error)));
          return;
        }
        this.orders.set(
          mergeBoard(result.orders, this.orders(), this.pending, new Date()),
        );
        this.pending.clear();
      });
    this.destroyRef.onDestroy(() => {
      for (const timer of this.flashTimers) {
        clearTimeout(timer);
      }
    });
  }

  ngOnInit(): void {
    if (this.soundEnabled()) {
      this.alert.ensure();
      this.soundBlocked.set(this.alert.blocked());
    }
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
    this.feed
      .watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => this.onMessage(message));
    this.feed
      .listCouriers()
      .pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef))
      .subscribe((couriers) => this.couriers.set(couriers));
    this.reload$.next();
  }

  @HostListener('document:click')
  unlockSound(): void {
    if (!this.soundEnabled() || !this.soundBlocked()) {
      return;
    }
    void this.alert.unlock().then(() => {
      this.soundBlocked.set(this.alert.blocked());
    });
  }

  reload(): void {
    this.reload$.next();
  }

  setSound(enabled: boolean): void {
    this.soundEnabled.set(enabled);
    writeSoundPreference(enabled);
    if (!enabled) {
      this.soundBlocked.set(false);
      return;
    }
    void this.alert.unlock().then(() => {
      this.soundBlocked.set(this.alert.blocked());
    });
  }

  onSoundChange(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.setSound(input.checked);
    }
  }

  onNoteInput(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLTextAreaElement) {
      this.note.set(input.value);
    }
  }

  focusFirstNew(): void {
    const first = this.orders().find((order) => order.status === 'NEW');
    if (first === undefined) {
      return;
    }
    document.getElementById(`order-${first.id}`)?.focus();
  }

  hasNew(): boolean {
    return this.orders().some((order) => order.status === 'NEW');
  }

  columnOrders(statuses: readonly string[]): OrderCard[] {
    return this.orders().filter((order) => statuses.includes(order.status));
  }

  age(createdAt: string): string {
    return ageLabel(createdAt, this.now());
  }

  customer(name: string): string {
    return firstName(name);
  }

  format(cents: number): string {
    return `R$ ${centsToReais(cents)}`;
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

  statusLabel(code: string): string {
    return STATUS_LABELS[code] ?? code;
  }

  isHighlighted(id: string): boolean {
    return this.highlighted().has(id);
  }

  canAccept(order: OrderCard): boolean {
    return order.status === 'NEW' && this.allows('orders.accept');
  }

  canReject(order: OrderCard): boolean {
    return order.status === 'NEW' && this.allows('orders.accept');
  }

  canPrepare(order: OrderCard): boolean {
    return order.status === 'ACCEPTED' && this.allows('orders.prepare');
  }

  canReady(order: OrderCard): boolean {
    return order.status === 'IN_PREPARATION' && this.allows('orders.prepare');
  }

  canPickup(order: OrderCard): boolean {
    return (
      order.status === 'READY' &&
      order.fulfillment === 'PICKUP' &&
      this.allows('orders.deliver')
    );
  }

  canAssign(order: OrderCard): boolean {
    return (
      order.status === 'READY' &&
      order.fulfillment === 'DELIVERY' &&
      this.allows('orders.assign_courier')
    );
  }

  canDispatch(order: OrderCard): boolean {
    return this.canAssign(order);
  }

  canDeliver(order: OrderCard): boolean {
    return (
      order.status === 'OUT_FOR_DELIVERY' &&
      order.fulfillment === 'DELIVERY' &&
      this.allows('orders.deliver')
    );
  }

  canCancel(order: OrderCard): boolean {
    return (
      (order.status === 'NEW' ||
        order.status === 'ACCEPTED' ||
        order.status === 'IN_PREPARATION') &&
      this.allows('orders.accept')
    );
  }

  showingNote(order: OrderCard, action: 'reject' | 'cancel'): boolean {
    const pending = this.noteFor();
    return pending !== null && pending.id === order.id && pending.action === action;
  }

  accept(order: OrderCard): void {
    this.run(order.id, 'accept', null);
  }

  beginNote(order: OrderCard, action: 'reject' | 'cancel'): void {
    this.noteFor.set({ id: order.id, action });
    this.note.set('');
    this.actionError.set('');
    this.actionErrorId.set(null);
  }

  dismissNote(): void {
    this.noteFor.set(null);
    this.note.set('');
  }

  confirmNote(order: OrderCard): void {
    const pending = this.noteFor();
    if (pending === null || pending.id !== order.id) {
      return;
    }
    const note = this.note().trim();
    if (note.length === 0 || note.length > 280) {
      this.actionErrorId.set(order.id);
      this.actionError.set('Informe uma nota de até 280 caracteres.');
      return;
    }
    this.run(order.id, pending.action === 'reject' ? 'reject' : 'cancel', note);
  }

  startPreparation(order: OrderCard): void {
    this.run(order.id, 'start-preparation', null);
  }

  markReady(order: OrderCard): void {
    this.run(order.id, 'ready', null);
  }

  completePickup(order: OrderCard): void {
    this.run(order.id, 'complete-pickup', null);
  }

  chosenCourier(orderId: string): string {
    return this.courierChoice()[orderId] ?? '';
  }

  onCourierChange(orderId: string, event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    this.courierChoice.update((current) => ({
      ...current,
      [orderId]: select.value,
    }));
  }

  assign(order: OrderCard): void {
    const courierId = this.chosenCourier(order.id);
    if (courierId.length === 0) {
      this.actionErrorId.set(order.id);
      this.actionError.set('Escolha um entregador.');
      return;
    }
    this.busyId.set(order.id);
    this.actionError.set('');
    this.actionErrorId.set(null);
    this.feed
      .assign(order.id, courierId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (card) => {
          this.pending.add(card.id);
          this.orders.set(placeCard(this.orders(), card, new Date()));
          this.busyId.set(null);
        },
        error: (error: unknown) => {
          this.busyId.set(null);
          this.actionErrorId.set(order.id);
          this.actionError.set(actionMessage(readErrorCode(error)));
        },
      });
  }

  dispatch(order: OrderCard): void {
    this.run(order.id, 'dispatch', null);
  }

  deliver(order: OrderCard): void {
    this.run(order.id, 'deliver', null);
  }

  private onMessage(message: OrderBoardMessage): void {
    if (message.kind === 'resync') {
      this.reload$.next();
      return;
    }
    this.onEvent(message.event);
  }

  private onEvent(event: OrderRealtimeEvent): void {
    const known = this.orders().some((order) => order.id === event.orderId);
    this.pending.add(event.orderId);
    if (!known) {
      this.feed
        .fetch(event.orderId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (card) => this.commitEvent(event, card),
          error: () => {
            this.error.set('Não foi possível carregar o pedido.');
          },
        });
      return;
    }
    this.commitEvent(event, null);
  }

  private commitEvent(event: OrderRealtimeEvent, fetched: OrderCard | null): void {
    const result = applyOrderEvent(this.orders(), event, fetched, new Date());
    this.orders.set(result.orders);
    if (!result.highlight) {
      return;
    }
    this.announcement.set(`Novo pedido ${event.orderNumber}`);
    this.flash(event.orderId);
    this.playAlert();
  }

  private run(id: string, action: OrderAction, note: string | null): void {
    this.busyId.set(id);
    this.actionError.set('');
    this.actionErrorId.set(null);
    this.feed
      .transition(id, action, note)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (card) => {
          this.pending.add(card.id);
          this.orders.set(placeCard(this.orders(), card, new Date()));
          this.busyId.set(null);
          this.noteFor.set(null);
          this.note.set('');
        },
        error: (error: unknown) => {
          this.busyId.set(null);
          this.actionErrorId.set(id);
          this.actionError.set(actionMessage(readErrorCode(error)));
        },
      });
  }

  private allows(permission: string): boolean {
    return this.session.currentUser()?.permissions.includes(permission) ?? false;
  }

  private flash(id: string): void {
    this.highlighted.update((current) => new Set([...current, id]));
    const timer = window.setTimeout(() => {
      this.highlighted.update((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, 4000);
    this.flashTimers.push(timer);
  }

  private playAlert(): void {
    if (!this.soundEnabled()) {
      return;
    }
    this.alert.ensure();
    if (this.alert.blocked()) {
      this.soundBlocked.set(true);
      return;
    }
    this.alert.play();
  }
}

function loadMessage(code: string): string {
  if (code === 'FORBIDDEN') {
    return 'Você não tem permissão para ver os pedidos.';
  }
  return 'Não foi possível carregar os pedidos.';
}

function actionMessage(code: string): string {
  if (code === 'ORDER_INVALID_TRANSITION') {
    return 'Essa ação não é permitida neste status.';
  }
  if (code === 'FORBIDDEN') {
    return 'Você não tem permissão para esta ação.';
  }
  if (code === 'ORDER_NOT_FOUND') {
    return 'Pedido não encontrado.';
  }
  if (code === 'COURIER_REQUIRED') {
    return 'Atribua um entregador antes de despachar.';
  }
  if (code === 'COURIER_NOT_FOUND') {
    return 'Entregador não encontrado.';
  }
  if (code === 'ORDER_NOT_READY' || code === 'PICKUP_NOT_ASSIGNABLE') {
    return 'Só um pedido de entrega pronto pode ser atribuído.';
  }
  if (code === 'ASSIGNMENT_EXISTS') {
    return 'Este pedido já tem um entregador.';
  }
  return 'Não foi possível atualizar o pedido.';
}
