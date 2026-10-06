import { readErrorCode } from '../../core/api-error';

export interface OnboardingStep {
  code: string;
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  doneAt: string | null;
  doneBy: string | null;
  note: string | null;
}

export interface OnboardingChecklist {
  published: boolean;
  steps: OnboardingStep[];
  nextCode: string | null;
  blockingCodes: string[];
}

const LABELS: Record<string, string> = {
  create_tenant: 'Criar estabelecimento',
  create_store: 'Criar loja',
  configure_branding: 'Configurar a marca',
  configure_domain: 'Configurar o domínio',
  configure_address: 'Configurar o endereço',
  configure_hours: 'Configurar os horários',
  configure_delivery: 'Configurar a entrega',
  create_owner: 'Criar o responsável',
  import_catalog: 'Cadastrar o cardápio',
  connect_whatsapp: 'Conectar o WhatsApp',
  create_couriers: 'Cadastrar entregadores',
  place_test_order: 'Fazer um pedido de teste',
  validate_notifications: 'Validar as notificações',
  train_team: 'Treinar a equipe',
  publish_store: 'Publicar a loja',
};

const LINKS: Record<string, string> = {
  configure_branding: '/configuracoes',
  configure_domain: '/configuracoes',
  configure_address: '/configuracoes',
  configure_hours: '/configuracoes',
  configure_delivery: '/configuracoes',
  connect_whatsapp: '/configuracoes',
  create_owner: '/equipe',
  create_couriers: '/equipe',
  import_catalog: '/cardapio',
  place_test_order: '/pedidos',
};

const MANUAL = new Set(['validate_notifications', 'train_team']);

const SKIPPABLE = new Set([
  'configure_domain',
  'configure_delivery',
  'create_owner',
  'import_catalog',
  'connect_whatsapp',
  'create_couriers',
  'place_test_order',
  'validate_notifications',
  'train_team',
]);

export function stepLabel(code: string): string {
  return LABELS[code] ?? code;
}

export function stepLink(code: string): string | null {
  return LINKS[code] ?? null;
}

export function statusLabel(status: OnboardingStep['status']): string {
  if (status === 'DONE') {
    return 'Feito';
  }
  if (status === 'SKIPPED') {
    return 'Pulado';
  }
  return 'Pendente';
}

export function canMarkManually(step: OnboardingStep): boolean {
  return step.status !== 'DONE' && MANUAL.has(step.code);
}

export function canSkip(step: OnboardingStep): boolean {
  return step.status === 'PENDING' && SKIPPABLE.has(step.code);
}

export function onboardingErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'ONBOARDING_INCOMPLETE') {
    const labels = readBlockingCodes(error).map(stepLabel);
    return labels.length > 0
      ? `Ainda falta: ${labels.join(', ')}.`
      : 'A loja ainda não tem o mínimo para publicar.';
  }
  if (code === 'FORBIDDEN') {
    return 'Só o responsável da loja publica o cardápio.';
  }
  if (code === 'ONBOARDING_STEP_NOT_MANUAL') {
    return 'Esse passo é concluído ao salvar a configuração.';
  }
  return 'Não foi possível atualizar a implantação.';
}

function readBlockingCodes(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('error' in error)) {
    return [];
  }
  const body = (error as { error?: unknown }).error;
  if (typeof body !== 'object' || body === null) {
    return [];
  }
  const details = (body as { error?: { details?: { codes?: unknown } } }).error
    ?.details;
  const codes = details?.codes;
  return Array.isArray(codes)
    ? codes.filter((item): item is string => typeof item === 'string')
    : [];
}
