import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  DELIVERY_ZONES_OVERLAP:
    'As faixas de distância se sobrepõem. Ajuste os intervalos.',
  DELIVERY_ZONE_INVALID:
    'Cada faixa precisa começar antes de terminar e caber no raio.',
  DELIVERY_CONFIG_NOT_FOUND: 'A configuração de entrega não foi encontrada.',
  FORBIDDEN: 'Você não tem permissão para configurar a loja.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
};

export function deliveryErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? code;
}
