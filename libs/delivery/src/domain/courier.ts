export const COURIER_STATUSES = ['AVAILABLE', 'UNAVAILABLE'] as const;

export type CourierStatus = (typeof COURIER_STATUSES)[number];

export interface CourierRecord {
  id: string;
  tenantId: string;
  storeId: string;
  userId: string;
  name: string;
  phone: string;
  status: CourierStatus;
  active: boolean;
  vehicleType: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isCourierStatus(value: string): value is CourierStatus {
  return (COURIER_STATUSES as readonly string[]).includes(value);
}
