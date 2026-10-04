import { Column, Entity, PrimaryColumn } from 'typeorm';

const timeOfDay = {
  to: (value: string): string => value,
  from: (value: string | Date): string => readSqlTime(value),
};

const flag = {
  to: (value: boolean): number => (value ? 1 : 0),
  from: (value: number | boolean | null): boolean =>
    value === true || value === 1,
};

@Entity({ name: 'business_hours' })
export class BusinessHourEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'tinyint' })
  weekday!: number;

  @Column({ name: 'opens_at', type: 'time', transformer: timeOfDay })
  opensAt!: string;

  @Column({ name: 'closes_at', type: 'time', transformer: timeOfDay })
  closesAt!: string;

  @Column({ type: 'tinyint', width: 1, transformer: flag })
  closed!: boolean;
}

function readSqlTime(value: string | Date): string {
  if (typeof value === 'string') {
    const match = /^(\d{2}:\d{2}:\d{2})/.exec(value);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }

  if (value instanceof Date) {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    const seconds = value.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  throw new Error('Unexpected time value from business_hours');
}
