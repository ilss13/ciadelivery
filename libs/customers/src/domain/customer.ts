export interface CustomerScope {
  tenantId: string;
  storeId: string;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export interface CustomerRecord {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddressRecord {
  id: string;
  tenantId: string;
  customerId: string;
  label: string | null;
  line: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

export interface CustomerConsentRecord {
  id: string;
  tenantId: string;
  customerId: string;
  purpose: 'OPERATIONAL' | 'MARKETING';
  granted: boolean;
  policyVersion: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

export interface CustomerSearch {
  phone?: string;
  name?: string;
}

export interface CustomerView {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddressView {
  id: string;
  label: string | null;
  line: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

export interface CustomerDetailView extends CustomerView {
  addresses: CustomerAddressView[];
}

export interface IdentifiedCustomer {
  customerId: string;
  name: string;
  phone: string;
}

export function toPage<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Page<T> {
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export function toCustomerView(customer: CustomerRecord): CustomerView {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function toAddressView(
  address: CustomerAddressRecord,
): CustomerAddressView {
  return {
    id: address.id,
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

export function toIdentifiedCustomer(
  customer: CustomerRecord,
): IdentifiedCustomer {
  return {
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
  };
}
