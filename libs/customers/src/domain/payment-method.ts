import { DomainException } from '@ciadelivery/shared';

export const PAYMENT_METHOD_CODES = [
  'CASH',
  'CARD_ON_DELIVERY',
  'PIX_MANUAL',
  'PAY_ON_PICKUP',
  'OTHER',
] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export interface PaymentMethodSeed {
  code: PaymentMethodCode;
  label: string;
  enabled: boolean;
  sortOrder: number;
}

export interface PaymentMethodRecord {
  id: string;
  tenantId: string;
  storeId: string;
  code: PaymentMethodCode;
  label: string;
  instructions: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PaymentMethodView {
  code: PaymentMethodCode;
  label: string;
  instructions: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PaymentMethodUpdate {
  code: PaymentMethodCode;
  label: string;
  instructions: string | null;
  enabled: boolean;
}

export function isPaymentMethodCode(value: string): value is PaymentMethodCode {
  return (PAYMENT_METHOD_CODES as readonly string[]).includes(value);
}

export function defaultPaymentMethods(): PaymentMethodSeed[] {
  return [
    { code: 'CASH', label: 'Dinheiro', enabled: true, sortOrder: 0 },
    {
      code: 'CARD_ON_DELIVERY',
      label: 'Cartão na entrega',
      enabled: false,
      sortOrder: 1,
    },
    { code: 'PIX_MANUAL', label: 'PIX', enabled: false, sortOrder: 2 },
    {
      code: 'PAY_ON_PICKUP',
      label: 'Pagar na retirada',
      enabled: true,
      sortOrder: 3,
    },
  ];
}

export function toPaymentMethodView(
  method: PaymentMethodRecord,
): PaymentMethodView {
  return {
    code: method.code,
    label: method.label,
    instructions: method.instructions,
    enabled: method.enabled,
    sortOrder: method.sortOrder,
  };
}

export function assertEnabledPaymentMethod(
  methods: readonly { enabled: boolean }[],
): void {
  if (!methods.some((method) => method.enabled)) {
    throw new DomainException(
      'PAYMENT_METHOD_REQUIRED',
      'At least one payment method must stay enabled',
      400,
    );
  }
}
