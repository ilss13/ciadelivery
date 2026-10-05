import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  PAYMENT_METHOD_REQUIRED:
    'Mantenha pelo menos uma forma de pagamento ativa.',
  PAYMENT_METHOD_NOT_FOUND: 'Forma de pagamento não encontrada.',
  FORBIDDEN: 'Você não tem permissão para configurar a loja.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
};

export function paymentErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? code;
}
