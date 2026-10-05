import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  INVALID_PHONE: 'Informe um telefone válido com DDD.',
  CUSTOMER_NOT_FOUND: 'Cliente não encontrado.',
  FORBIDDEN: 'Você não tem permissão para ver os clientes.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto.',
};

export function customerErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? code;
}
