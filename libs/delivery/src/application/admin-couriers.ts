import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore, StoreRecord } from '@ciadelivery/stores';
import {
  currentTenant,
  TransactionContext,
  UnitOfWork,
} from '@ciadelivery/tenancy/domain';
import {
  PasswordHasher,
  RequestActor,
  Users,
  assertAssignablePermissions,
  assertStrongPassword,
  normalizeEmail,
} from '@ciadelivery/users';
import { CourierRecord, CourierStatus } from '../domain/courier';
import { Couriers } from '../domain/couriers.port';

export interface CourierView {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  status: CourierStatus;
  active: boolean;
  vehicleType: string | null;
  notes: string | null;
}

export interface CreatedCourier extends CourierView {
  initialPassword: string | null;
}

export interface CourierPage {
  items: CourierView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateCourierCommand {
  name: string;
  phone: string;
  userId: string | null;
  email: string | null;
  password: string | null;
  vehicleType: string | null;
  notes: string | null;
  status: CourierStatus;
}

export interface UpdateCourierCommand {
  name?: string;
  phone?: string;
  status?: CourierStatus;
  active?: boolean;
  vehicleType?: string | null;
  notes?: string | null;
}

type StepMarker = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

const idleSteps: StepMarker = {
  async markDone(): Promise<void> {
    return undefined;
  },
};

export class AdminCouriers {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly couriers: Couriers,
    private readonly users: Users,
    private readonly hasher: PasswordHasher,
    private readonly stores: CurrentStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly steps: StepMarker = idleSteps,
  ) {}

  async list(
    actor: RequestActor,
    page: number,
    pageSize: number,
    active: boolean | null,
    status: CourierStatus | null,
  ): Promise<CourierPage> {
    assertCanReadCouriers(actor);
    const store = await requireStore(actor, this.stores);
    const listed = await this.couriers.list(store.tenantId, store.id, {
      page,
      pageSize,
      active,
      status,
    });
    const items: CourierView[] = [];
    for (const courier of listed.items) {
      items.push(await this.toView(courier));
    }
    return {
      items,
      page,
      pageSize,
      total: listed.total,
      totalPages: listed.total === 0 ? 0 : Math.ceil(listed.total / pageSize),
    };
  }

  async create(
    actor: RequestActor,
    command: CreateCourierCommand,
  ): Promise<CreatedCourier> {
    const store = await requireStore(actor, this.stores);
    const now = new Date();
    if (command.userId !== null) {
      const linked = await this.linkUser(store, command.userId);
      const courier = draft(store, linked.userId, command, now);
      await this.unitOfWork.run(async (tx) => {
        await this.couriers.insert(courier, tx);
        await this.steps.markDone(
          {
            tenantId: store.tenantId,
            code: 'create_couriers',
            actorId: actor.userId,
          },
          tx,
        );
      });
      this.logger.log(`Courier ${courier.id} linked`, 'AdminCouriers');
      return {
        ...(await this.toView(courier, linked.email)),
        initialPassword: null,
      };
    }

    if (command.email === null || command.password === null) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
      );
    }
    assertAssignablePermissions(actor, 'COURIER', []);
    assertStrongPassword(command.password);
    const password = command.password;
    const userId = randomUUID();
    const email = normalizeEmail(command.email);
    const passwordHash = await this.hasher.hash(password);
    const courier = draft(store, userId, command, now);
    await this.unitOfWork.run(async (tx) => {
      await this.users.insert(
        {
          id: userId,
          tenantId: store.tenantId,
          storeId: store.id,
          name: command.name.trim(),
          email,
          passwordHash,
          role: 'COURIER',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
        [],
        tx,
      );
      await this.couriers.insert(courier, tx);
      await this.steps.markDone(
        {
          tenantId: store.tenantId,
          code: 'create_couriers',
          actorId: actor.userId,
        },
        tx,
      );
    });
    this.logger.log(`Courier ${courier.id} created`, 'AdminCouriers');
    return {
      ...(await this.toView(courier, email)),
      initialPassword: password,
    };
  }

  async update(
    actor: RequestActor,
    courierId: string,
    command: UpdateCourierCommand,
  ): Promise<CourierView> {
    const store = await requireStore(actor, this.stores);
    const updated = await this.unitOfWork.run(async (tx) => {
      const current = await this.couriers.lockInStore(
        store.tenantId,
        store.id,
        courierId,
        tx,
      );
      if (current === null) {
        throw courierNotFound();
      }
      const next: CourierRecord = {
        ...current,
        name: command.name === undefined ? current.name : command.name.trim(),
        phone: command.phone === undefined ? current.phone : command.phone.trim(),
        status: command.status ?? current.status,
        active: command.active ?? current.active,
        vehicleType:
          command.vehicleType === undefined
            ? current.vehicleType
            : emptyToNull(command.vehicleType),
        notes:
          command.notes === undefined ? current.notes : emptyToNull(command.notes),
        updatedAt: new Date(),
      };
      await this.couriers.update(next, tx);
      return next;
    });
    this.logger.log(`Courier ${updated.id} updated`, 'AdminCouriers');
    return this.toView(updated);
  }

  private async linkUser(
    store: StoreRecord,
    userId: string,
  ): Promise<{ userId: string; email: string }> {
    const user = await this.users.findByIdInTenant(userId, store.tenantId);
    if (
      user === null ||
      user.role !== 'COURIER' ||
      user.status !== 'ACTIVE' ||
      user.storeId !== store.id
    ) {
      throw courierNotFound();
    }
    const existing = await this.couriers.findByUserId(store.tenantId, user.id);
    if (existing !== null) {
      throw new DomainException(
        'COURIER_ALREADY_EXISTS',
        'The user is already a courier',
        409,
      );
    }
    return { userId: user.id, email: user.email };
  }

  private async toView(
    courier: CourierRecord,
    email?: string,
  ): Promise<CourierView> {
    const resolved =
      email ??
      (await this.users.findByIdInTenant(courier.userId, courier.tenantId))
        ?.email ??
      '';
    return {
      id: courier.id,
      userId: courier.userId,
      name: courier.name,
      phone: courier.phone,
      email: resolved,
      status: courier.status,
      active: courier.active,
      vehicleType: courier.vehicleType,
      notes: courier.notes,
    };
  }
}

function draft(
  store: StoreRecord,
  userId: string,
  command: CreateCourierCommand,
  now: Date,
): CourierRecord {
  return {
    id: randomUUID(),
    tenantId: store.tenantId,
    storeId: store.id,
    userId,
    name: command.name.trim(),
    phone: command.phone.trim(),
    status: command.status,
    active: true,
    vehicleType: emptyToNull(command.vehicleType),
    notes: emptyToNull(command.notes),
    createdAt: now,
    updatedAt: now,
  };
}

function emptyToNull(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assertCanReadCouriers(actor: RequestActor): void {
  if (
    actor.permissions.includes('couriers.manage') ||
    actor.permissions.includes('orders.assign_courier')
  ) {
    return;
  }
  throw new DomainException('FORBIDDEN', 'The permission is required', 403);
}

async function requireStore(
  actor: RequestActor,
  stores: CurrentStore,
): Promise<StoreRecord> {
  if (actor.tenantId === null || actor.storeId === null) {
    throw new DomainException('FORBIDDEN', 'The permission is required', 403);
  }
  const tenant = currentTenant();
  if (tenant === null || tenant.id !== actor.tenantId) {
    throw new DomainException(
      'TENANT_NOT_FOUND',
      'The tenant was not found',
      404,
    );
  }
  const store = await stores.findForCurrentTenant();
  if (
    store === null ||
    store.tenantId !== actor.tenantId ||
    store.id !== actor.storeId
  ) {
    throw new DomainException('STORE_NOT_FOUND', 'The store was not found', 404);
  }
  return store;
}

function courierNotFound(): DomainException {
  return new DomainException(
    'COURIER_NOT_FOUND',
    'The courier was not found',
    404,
  );
}
