import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Você não acompanha os pedidos desta loja.',
  UNAUTHENTICATED: 'Entre de novo para ver o painel.',
};

export function dashboardErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? 'Não foi possível carregar o painel.';
}
