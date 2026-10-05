import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { EntityManager, FindOptionsWhere, Like } from 'typeorm';
import {
  CustomerAddressRecord,
  CustomerConsentRecord,
  CustomerRecord,
  CustomerScope,
  CustomerSearch,
  Page,
  PageQuery,
  toPage,
} from '../domain/customer';
import { CustomerRepository } from '../domain/customer-repository';
import {
  PaymentMethodCode,
  PaymentMethodRecord,
  isPaymentMethodCode,
} from '../domain/payment-method';
import {
  CustomerAddressEntity,
  CustomerConsentEntity,
  CustomerEntity,
  PaymentMethodEntity,
} from './customer.entities';

@Injectable()
export class TypeOrmCustomers implements CustomerRepository {
  constructor(private readonly database: DatabaseReady) {}

  async findByPhone(
    scope: CustomerScope,
    phone: string,
    tx?: TransactionContext,
  ): Promise<CustomerRecord | null> {
    const manager = await this.manager(tx);
    const row = await manager.findOne(CustomerEntity, {
      where: { tenantId: scope.tenantId, storeId: scope.storeId, phone },
    });
    return row === null ? null : toCustomer(row);
  }

  async findById(
    scope: CustomerScope,
    id: string,
  ): Promise<CustomerRecord | null> {
    const manager = await this.manager();
    const row = await manager.findOne(CustomerEntity, {
      where: { id, tenantId: scope.tenantId, storeId: scope.storeId },
    });
    return row === null ? null : toCustomer(row);
  }

  async insert(
    customer: CustomerRecord,
    tx?: TransactionContext,
  ): Promise<void> {
    const manager = await this.manager(tx);
    await manager.insert(CustomerEntity, toCustomerRow(customer));
  }

  async updateName(
    customer: CustomerRecord,
    tx?: TransactionContext,
  ): Promise<void> {
    const manager = await this.manager(tx);
    await manager.update(
      CustomerEntity,
      { id: customer.id, tenantId: customer.tenantId, storeId: customer.storeId },
      { name: customer.name, updatedAt: customer.updatedAt },
    );
  }

  async lockByPhone(
    scope: CustomerScope,
    phone: string,
    tx: TransactionContext,
  ): Promise<CustomerRecord | null> {
    const row = await managerOf(tx)
      .createQueryBuilder(CustomerEntity, 'customer')
      .setLock('pessimistic_write')
      .where('customer.tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('customer.store_id = :storeId', { storeId: scope.storeId })
      .andWhere('customer.phone = :phone', { phone })
      .getOne();
    return row === null ? null : toCustomer(row);
  }

  async insertAddress(
    address: CustomerAddressRecord,
    tx: TransactionContext,
  ): Promise<void> {
    await managerOf(tx).insert(CustomerAddressEntity, toAddressRow(address));
  }

  async insertConsents(
    consents: readonly CustomerConsentRecord[],
    tx: TransactionContext,
  ): Promise<void> {
    if (consents.length === 0) {
      return;
    }
    await managerOf(tx).insert(
      CustomerConsentEntity,
      consents.map(toConsentRow),
    );
  }

  async findPaymentMethod(
    scope: CustomerScope,
    code: string,
    tx: TransactionContext,
  ): Promise<PaymentMethodRecord | null> {
    if (!isPaymentMethodCode(code)) {
      return null;
    }
    const row = await managerOf(tx).findOne(PaymentMethodEntity, {
      where: { tenantId: scope.tenantId, storeId: scope.storeId, code },
    });
    return row === null ? null : toPaymentMethod(row);
  }

  async list(
    scope: CustomerScope,
    page: PageQuery,
    search: CustomerSearch,
  ): Promise<Page<CustomerRecord>> {
    const manager = await this.manager();
    const where: FindOptionsWhere<CustomerEntity> = {
      tenantId: scope.tenantId,
      storeId: scope.storeId,
    };
    if (search.phone !== undefined) {
      where.phone = search.phone;
    }
    if (search.name !== undefined) {
      where.name = Like(likeContains(search.name));
    }

    const [rows, total] = await manager.findAndCount(CustomerEntity, {
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return toPage(rows.map(toCustomer), total, page.page, page.pageSize);
  }

  async listAddresses(
    scope: CustomerScope,
    customerId: string,
  ): Promise<CustomerAddressRecord[]> {
    const manager = await this.manager();
    const rows = await manager.find(CustomerAddressEntity, {
      where: {
        tenantId: scope.tenantId,
        customerId,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows
      .filter((row) => row.tenantId === scope.tenantId)
      .map(toAddress);
  }

  async listConsents(
    scope: CustomerScope,
    customerId: string,
  ): Promise<CustomerConsentRecord[]> {
    const manager = await this.manager();
    const rows = await manager.find(CustomerConsentEntity, {
      where: { tenantId: scope.tenantId, customerId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toConsent);
  }

  async lockById(
    scope: CustomerScope,
    id: string,
    tx: TransactionContext,
  ): Promise<CustomerRecord | null> {
    const row = await managerOf(tx)
      .createQueryBuilder(CustomerEntity, 'customer')
      .setLock('pessimistic_write')
      .where('customer.id = :id', { id })
      .andWhere('customer.tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('customer.store_id = :storeId', { storeId: scope.storeId })
      .getOne();
    return row === null ? null : toCustomer(row);
  }

  async applyAnonymized(
    customer: CustomerRecord,
    tx: TransactionContext,
  ): Promise<void> {
    await managerOf(tx).update(
      CustomerEntity,
      {
        id: customer.id,
        tenantId: customer.tenantId,
        storeId: customer.storeId,
      },
      {
        name: customer.name,
        phone: customer.phone,
        updatedAt: customer.updatedAt,
      },
    );
  }

  async reduceAddressesToCity(
    scope: CustomerScope,
    customerId: string,
    tx: TransactionContext,
  ): Promise<void> {
    await managerOf(tx)
      .createQueryBuilder()
      .update(CustomerAddressEntity)
      .set({
        label: null,
        line: '',
        number: '',
        complement: null,
        district: '',
        postalCode: '',
        latitude: null,
        longitude: null,
      })
      .where('tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('customer_id = :customerId', { customerId })
      .execute();
  }

  async listPaymentMethods(scope: CustomerScope): Promise<PaymentMethodRecord[]> {
    const manager = await this.manager();
    const rows = await manager.find(PaymentMethodEntity, {
      where: { tenantId: scope.tenantId, storeId: scope.storeId },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
    return rows.map(toPaymentMethod);
  }

  async insertPaymentMethods(
    methods: readonly PaymentMethodRecord[],
  ): Promise<void> {
    if (methods.length === 0) {
      return;
    }
    const manager = await this.manager();
    await manager.save(
      PaymentMethodEntity,
      methods.map(toPaymentMethodRow),
    );
  }

  async lockPaymentMethods(
    scope: CustomerScope,
    tx: TransactionContext,
  ): Promise<PaymentMethodRecord[]> {
    const rows = await managerOf(tx)
      .createQueryBuilder(PaymentMethodEntity, 'method')
      .setLock('pessimistic_write')
      .where('method.tenant_id = :tenantId', { tenantId: scope.tenantId })
      .andWhere('method.store_id = :storeId', { storeId: scope.storeId })
      .orderBy('method.sort_order', 'ASC')
      .addOrderBy('method.code', 'ASC')
      .getMany();
    return rows.map(toPaymentMethod);
  }

  async savePaymentMethods(
    methods: readonly PaymentMethodRecord[],
    tx: TransactionContext,
  ): Promise<void> {
    if (methods.length === 0) {
      return;
    }
    await managerOf(tx).save(
      PaymentMethodEntity,
      methods.map(toPaymentMethodRow),
    );
  }

  private async manager(tx?: TransactionContext): Promise<EntityManager> {
    if (tx !== undefined) {
      return managerOf(tx);
    }
    const dataSource = await this.database.ensure();
    return dataSource.manager;
  }
}

function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function toCustomer(row: CustomerEntity): CustomerRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    name: row.name,
    phone: row.phone,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function toCustomerRow(customer: CustomerRecord): CustomerEntity {
  return {
    id: customer.id,
    tenantId: customer.tenantId,
    storeId: customer.storeId,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function toAddress(row: CustomerAddressEntity): CustomerAddressRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    label: row.label,
    line: row.line,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: new Date(row.createdAt),
  };
}

function toPaymentMethod(row: PaymentMethodEntity): PaymentMethodRecord {
  if (!isPaymentMethodCode(row.code)) {
    throw new Error(`Unexpected payment method code ${row.code}`);
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    storeId: row.storeId,
    code: row.code,
    label: row.label,
    instructions: row.instructions,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

function toAddressRow(address: CustomerAddressRecord): CustomerAddressEntity {
  return {
    id: address.id,
    tenantId: address.tenantId,
    customerId: address.customerId,
    label: address.label,
    line: address.line,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    createdAt: address.createdAt,
  };
}

function toConsent(row: CustomerConsentEntity): CustomerConsentRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    purpose: row.purpose,
    granted: row.granted,
    policyVersion: row.policyVersion,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: new Date(row.createdAt),
  };
}

function toConsentRow(consent: CustomerConsentRecord): CustomerConsentEntity {
  return {
    id: consent.id,
    tenantId: consent.tenantId,
    customerId: consent.customerId,
    purpose: consent.purpose,
    granted: consent.granted,
    policyVersion: consent.policyVersion,
    ip: consent.ip,
    userAgent: consent.userAgent,
    createdAt: consent.createdAt,
  };
}

function toPaymentMethodRow(method: PaymentMethodRecord): PaymentMethodEntity {
  return {
    id: method.id,
    tenantId: method.tenantId,
    storeId: method.storeId,
    code: method.code satisfies PaymentMethodCode,
    label: method.label,
    instructions: method.instructions,
    enabled: method.enabled,
    sortOrder: method.sortOrder,
  };
}
