import { randomUUID } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import { CustomerRepository } from '../domain/customer-repository';
import {
  PaymentMethodRecord,
  PaymentMethodUpdate,
  PaymentMethodView,
  assertEnabledPaymentMethod,
  defaultPaymentMethods,
  toPaymentMethodView,
} from '../domain/payment-method';
import { requireActorStore, scopeOf } from './actor-store';

export class PaymentMethods {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async list(actor: RequestActor): Promise<PaymentMethodView[]> {
    const store = await requireActorStore(actor, this.stores);
    const scope = scopeOf(store);
    await this.ensureDefaults(scope.tenantId, scope.storeId);
    const methods = await this.customers.listPaymentMethods(scope);
    return methods.map(toPaymentMethodView);
  }

  async replace(
    actor: RequestActor,
    updates: readonly PaymentMethodUpdate[],
  ): Promise<PaymentMethodView[]> {
    const store = await requireActorStore(actor, this.stores);
    const scope = scopeOf(store);
    await this.ensureDefaults(scope.tenantId, scope.storeId);
    const seen = new Set<string>();
    for (const update of updates) {
      if (seen.has(update.code)) {
        throw new DomainException(
          'VALIDATION_ERROR',
          'The request payload is invalid',
          400,
        );
      }
      seen.add(update.code);
    }

    const saved = await this.unitOfWork.run(async (tx) => {
      const current = await this.customers.lockPaymentMethods(scope, tx);
      const byCode = new Map(current.map((method) => [method.code, method]));
      for (const update of updates) {
        const method = byCode.get(update.code);
        if (method === undefined) {
          throw new DomainException(
            'PAYMENT_METHOD_NOT_FOUND',
            'The payment method was not found',
            404,
          );
        }
        const label = update.label.trim();
        if (label.length === 0) {
          throw new DomainException(
            'VALIDATION_ERROR',
            'The request payload is invalid',
            400,
          );
        }
        method.label = label;
        method.instructions = update.instructions;
        method.enabled = update.enabled;
      }
      assertEnabledPaymentMethod(current);
      await this.customers.savePaymentMethods(current, tx);
      return current;
    });

    return saved.map(toPaymentMethodView);
  }

  private async ensureDefaults(
    tenantId: string,
    storeId: string,
  ): Promise<void> {
    const scope = { tenantId, storeId };
    const existing = await this.customers.listPaymentMethods(scope);
    if (existing.length > 0) {
      return;
    }

    const methods: PaymentMethodRecord[] = defaultPaymentMethods().map(
      (method) => ({
        id: randomUUID(),
        tenantId,
        storeId,
        code: method.code,
        label: method.label,
        instructions: null,
        enabled: method.enabled,
        sortOrder: method.sortOrder,
      }),
    );
    try {
      await this.customers.insertPaymentMethods(methods);
    } catch (error) {
      if (!isMysqlDuplicate(error)) {
        throw error;
      }
    }
  }
}

function isMysqlDuplicate(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return (
    candidate.code === 'ER_DUP_ENTRY' ||
    candidate.driverError?.code === 'ER_DUP_ENTRY'
  );
}
