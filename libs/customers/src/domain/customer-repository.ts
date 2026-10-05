import { TransactionContext } from '@ciadelivery/tenancy/domain';
import {
  CustomerAddressRecord,
  CustomerConsentRecord,
  CustomerRecord,
  CustomerScope,
  CustomerSearch,
  Page,
  PageQuery,
} from './customer';
import { PaymentMethodRecord } from './payment-method';

export interface CustomerRepository {
  findByPhone(
    scope: CustomerScope,
    phone: string,
  ): Promise<CustomerRecord | null>;
  findById(scope: CustomerScope, id: string): Promise<CustomerRecord | null>;
  insert(customer: CustomerRecord, tx?: TransactionContext): Promise<void>;
  updateName(customer: CustomerRecord, tx?: TransactionContext): Promise<void>;
  lockByPhone(
    scope: CustomerScope,
    phone: string,
    tx: TransactionContext,
  ): Promise<CustomerRecord | null>;
  insertAddress(
    address: CustomerAddressRecord,
    tx: TransactionContext,
  ): Promise<void>;
  insertConsents(
    consents: readonly CustomerConsentRecord[],
    tx: TransactionContext,
  ): Promise<void>;
  findPaymentMethod(
    scope: CustomerScope,
    code: string,
    tx: TransactionContext,
  ): Promise<PaymentMethodRecord | null>;
  list(
    scope: CustomerScope,
    page: PageQuery,
    search: CustomerSearch,
  ): Promise<Page<CustomerRecord>>;
  listAddresses(
    scope: CustomerScope,
    customerId: string,
  ): Promise<CustomerAddressRecord[]>;
  listPaymentMethods(scope: CustomerScope): Promise<PaymentMethodRecord[]>;
  insertPaymentMethods(methods: readonly PaymentMethodRecord[]): Promise<void>;
  lockPaymentMethods(
    scope: CustomerScope,
    tx: TransactionContext,
  ): Promise<PaymentMethodRecord[]>;
  savePaymentMethods(
    methods: readonly PaymentMethodRecord[],
    tx: TransactionContext,
  ): Promise<void>;
}

export const CUSTOMERS = Symbol('CUSTOMERS');
