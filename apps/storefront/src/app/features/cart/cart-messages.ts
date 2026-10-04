import { formatBrl } from '../../shared/money';

const MESSAGES: Record<string, string> = {
  CART_EMPTY: 'O carrinho está vazio.',
  PRODUCT_NOT_FOUND: 'Este item não está mais no cardápio.',
  PRODUCT_UNAVAILABLE: 'Este item está indisponível. Remova-o do carrinho.',
  OPTION_NOT_FOUND: 'Uma opção escolhida não existe neste produto.',
  OPTION_UNAVAILABLE: 'Uma opção escolhida está indisponível. Remova-a do item.',
  MINIMUM_ORDER_NOT_MET: 'O pedido ainda não atingiu o valor mínimo.',
  OPTION_SELECTION_INVALID: 'Revise as opções deste item.',
  INVALID_QUANTITY: 'A quantidade deve ser de 1 a 99.',
  NOTES_TOO_LONG: 'A observação pode ter no máximo 280 caracteres.',
  STORE_CLOSED: 'A loja está fechada.',
};

export function minimumOrderShortfallMessage(missingCents: number): string {
  return `Faltam ${formatBrl(missingCents)} para o pedido mínimo.`;
}

export function cartErrorMessage(code: string): string {
  return MESSAGES[code] ?? 'Não foi possível validar este item.';
}
