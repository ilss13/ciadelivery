import { randomUUID } from 'node:crypto';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import {
  CustomerRecord,
  IdentifiedCustomer,
  toIdentifiedCustomer,
} from '../domain/customer';
import { CustomerRepository } from '../domain/customer-repository';
import { IdentifyRateLimit } from '../domain/identify-rate-limit';
import { normalizeBrazilPhone } from '../domain/phone';
import { requirePublicStore, scopeOf } from './actor-store';

export class IdentifyCustomer {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
    private readonly rateLimit: IdentifyRateLimit,
  ) {}

  async execute(
    input: { name: string; phone: string },
    ip: string,
  ): Promise<IdentifiedCustomer> {
    await this.rateLimit.consume(ip);
    const phone = normalizeBrazilPhone(input.phone);
    const name = input.name.trim();
    if (name.length === 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
      );
    }

    const store = await requirePublicStore(this.stores);
    const scope = scopeOf(store);
    const existing = await this.customers.findByPhone(scope, phone);
    if (existing !== null) {
      const updated = await this.rename(existing, name);
      this.logger.log(`Customer identified ${updated.id}`, 'IdentifyCustomer');
      return toIdentifiedCustomer(updated);
    }

    const created: CustomerRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await this.customers.insert(created);
    } catch (error) {
      if (!isMysqlDuplicate(error)) {
        throw error;
      }
      const raced = await this.customers.findByPhone(scope, phone);
      if (raced === null) {
        throw error;
      }
      const updated = await this.rename(raced, name);
      this.logger.log(`Customer identified ${updated.id}`, 'IdentifyCustomer');
      return toIdentifiedCustomer(updated);
    }

    this.logger.log(`Customer identified ${created.id}`, 'IdentifyCustomer');
    return toIdentifiedCustomer(created);
  }

  private async rename(
    customer: CustomerRecord,
    name: string,
  ): Promise<CustomerRecord> {
    const updated: CustomerRecord = {
      ...customer,
      name,
      updatedAt: new Date(),
    };
    await this.customers.updateName(updated);
    return updated;
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
