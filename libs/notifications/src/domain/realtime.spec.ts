import {
  decideRoomJoin,
  newOrderNotificationCopy,
  orderRealtimeDispatch,
  parseRealtimeEnvelope,
  readRealtimeCredentials,
  roomsForStaff,
} from './realtime';

const storeId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';

describe('realtime rooms', () => {
  const payload = {
    orderId,
    storeId,
    status: 'NEW',
    orderNumber: 12,
    occurredAt: '2026-10-04T12:00:00.000Z',
    fulfillment: 'PICKUP',
  };

  it('sends a new order only to the store room', () => {
    expect(orderRealtimeDispatch({ type: 'order.created', payload })).toEqual({
      event: 'order.created',
      storeId,
      rooms: [`store:${storeId}`],
      payload: {
        orderId,
        status: 'NEW',
        orderNumber: 12,
        occurredAt: '2026-10-04T12:00:00.000Z',
      },
    });
  });

  it('sends later order events to the store and the order room', () => {
    const dispatch = orderRealtimeDispatch({
      type: 'order.accepted',
      payload: { ...payload, status: 'ACCEPTED' },
    });
    expect(dispatch?.rooms).toEqual([`store:${storeId}`, `order:${orderId}`]);
    expect(dispatch?.payload.status).toBe('ACCEPTED');
  });

  it('drops an order event that cannot be routed', () => {
    expect(
      orderRealtimeDispatch({
        type: 'order.created',
        payload: { orderId, status: 'NEW', orderNumber: 1 },
      }),
    ).toBeNull();
    expect(
      orderRealtimeDispatch({ type: 'test.fail', payload }),
    ).toBeNull();
  });

  it('keeps couriers out of the store room and in their own room', () => {
    expect(
      roomsForStaff({
        role: 'COURIER',
        userId: 'user-1',
        tenantId,
        storeId,
        permissions: ['orders.read'],
      }),
    ).toEqual([`tenant:${tenantId}`, 'courier:user-1']);
    expect(
      roomsForStaff({
        role: 'KITCHEN',
        userId: 'user-2',
        tenantId,
        storeId,
        permissions: ['orders.read'],
      }),
    ).toEqual([`tenant:${tenantId}`, `store:${storeId}`]);
    expect(
      roomsForStaff({
        role: 'ATTENDANT',
        userId: 'user-3',
        tenantId,
        storeId,
        permissions: ['orders.read'],
      }),
    ).toEqual([`tenant:${tenantId}`, `store:${storeId}`]);
    expect(
      roomsForStaff({
        role: 'OWNER',
        userId: 'user-4',
        tenantId,
        storeId,
        permissions: ['catalog.manage'],
      }),
    ).toEqual([]);
  });

  it('also sends assignment events to the courier room', () => {
    const assigned = orderRealtimeDispatch({
      type: 'order.courier_assigned',
      payload: { ...payload, status: 'READY', courierUserId: 'user-1' },
    });
    expect(assigned?.rooms).toEqual([
      `store:${storeId}`,
      `order:${orderId}`,
      'courier:user-1',
    ]);
    const dispatched = orderRealtimeDispatch({
      type: 'order.out_for_delivery',
      payload: {
        ...payload,
        status: 'OUT_FOR_DELIVERY',
        courierUserId: 'user-1',
      },
    });
    expect(dispatched?.rooms).toEqual([
      `store:${storeId}`,
      `order:${orderId}`,
      'courier:user-1',
    ]);
    expect(decideRoomJoin(['courier:user-1'], 'courier:user-1')).toBe('join');
    expect(decideRoomJoin(['courier:user-1'], 'courier:user-2')).toBe('ignore');
  });

  it('ignores a room the connection was not granted', () => {
    const allowed = [`store:${storeId}`];
    expect(decideRoomJoin(allowed, `store:${storeId}`)).toBe('join');
    expect(decideRoomJoin(allowed, `order:${orderId}`)).toBe('ignore');
    expect(decideRoomJoin(allowed, 'store:not-a-room')).toBe('ignore');
  });

  it('reads the staff token before the tracking token', () => {
    expect(
      readRealtimeCredentials({
        queryToken: 'query-token',
        authToken: 'access-token',
        trackingToken: 'track',
      }),
    ).toEqual({ kind: 'staff', token: 'access-token' });
    expect(
      readRealtimeCredentials({
        queryToken: ['query-token'],
        authToken: ' ',
        trackingToken: null,
      }),
    ).toEqual({ kind: 'staff', token: 'query-token' });
    expect(
      readRealtimeCredentials({
        queryToken: undefined,
        authToken: undefined,
        trackingToken: 'track',
      }),
    ).toEqual({ kind: 'customer', trackingToken: 'track' });
    expect(
      readRealtimeCredentials({
        queryToken: '',
        authToken: null,
        trackingToken: '  ',
      }),
    ).toBeNull();
  });

  it('names the new-order notification and parses envelopes', () => {
    expect(newOrderNotificationCopy(4)).toEqual({
      title: 'Novo pedido #4',
      body: 'Novo pedido #4',
    });
    expect(
      parseRealtimeEnvelope(
        JSON.stringify({
          event: 'order.created',
          rooms: [`store:${storeId}`],
          payload: { orderId, status: 'NEW', orderNumber: 4, occurredAt: '2026-10-04T12:00:00.000Z' },
        }),
      )?.event,
    ).toBe('order.created');
    expect(parseRealtimeEnvelope('not-json')).toBeNull();
  });
});
