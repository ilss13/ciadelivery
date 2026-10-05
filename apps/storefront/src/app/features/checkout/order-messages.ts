import { HttpErrorResponse } from '@angular/common/http';
import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  CART_INVALID: 'O carrinho não está válido. Volte e revise os itens.',
  STORE_CLOSED: 'A loja está fechada.',
  MINIMUM_ORDER_NOT_MET: 'O pedido ainda não atingiu o valor mínimo.',
  PAYMENT_METHOD_DISABLED: 'Essa forma de pagamento não está disponível.',
  CONSENT_REQUIRED: 'Autorize o uso dos dados para realizar o pedido.',
  DELIVERY_DISABLED: 'A entrega não está disponível.',
  PICKUP_DISABLED: 'A retirada não está disponível.',
  ORDER_NOT_FOUND: 'Pedido não encontrado.',
  IDEMPOTENCY_CONFLICT: 'Não foi possível repetir o envio. Revise o pedido e tente de novo.',
};

export function orderErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'Não foi possível concluir. Tente de novo.';
  }
  const code = readErrorCode(error);
  if (code === 'INTERNAL_ERROR' && !(error instanceof HttpErrorResponse)) {
    return 'Não foi possível concluir. Tente de novo.';
  }
  return MESSAGES[code] ?? 'Não foi possível concluir. Tente de novo.';
}
