import { readErrorCode } from '../../core/api-error';

export const TEAM_ROLES = [
  { value: 'OWNER', label: 'Responsável' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'ATTENDANT', label: 'Atendente' },
  { value: 'KITCHEN', label: 'Cozinha' },
  { value: 'COURIER', label: 'Entregador' },
] as const;

export const PERMISSIONS = [
  { value: 'users.manage', label: 'Gerir equipe' },
  { value: 'catalog.manage', label: 'Gerir cardápio' },
  { value: 'orders.read', label: 'Ver pedidos' },
  { value: 'orders.accept', label: 'Aceitar pedidos' },
  { value: 'orders.prepare', label: 'Preparar pedidos' },
  { value: 'orders.assign_courier', label: 'Atribuir entregador' },
  { value: 'orders.deliver', label: 'Marcar entrega' },
  { value: 'store.configure', label: 'Configurar a loja' },
  { value: 'customers.read', label: 'Ver clientes' },
  { value: 'couriers.manage', label: 'Gerir entregadores' },
  { value: 'whatsapp.operate', label: 'Operar WhatsApp' },
  { value: 'reports.read', label: 'Ver relatórios' },
  { value: 'audit.read', label: 'Ver auditoria' },
] as const;

const ROLE_DEFAULTS: Record<string, readonly string[]> = {
  OWNER: PERMISSIONS.map((item) => item.value),
  MANAGER: [
    'catalog.manage',
    'orders.read',
    'orders.accept',
    'orders.prepare',
    'orders.assign_courier',
    'orders.deliver',
    'customers.read',
    'couriers.manage',
    'whatsapp.operate',
    'reports.read',
  ],
  ATTENDANT: [
    'orders.read',
    'orders.accept',
    'orders.prepare',
    'orders.assign_courier',
    'customers.read',
    'whatsapp.operate',
  ],
  KITCHEN: ['orders.read', 'orders.prepare'],
  COURIER: ['orders.read', 'orders.deliver'],
};

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Só o responsável da loja gere a equipe.',
  LAST_OWNER: 'O último responsável da loja não pode ser desabilitado.',
  WEAK_PASSWORD: 'A senha temporária não atende à política.',
  ROLE_NOT_ALLOWED: 'Esse papel não pode ser atribuído.',
  EMAIL_TAKEN: 'Este email já está em uso.',
  OWNER_ALREADY_EXISTS: 'Esta loja já tem um responsável.',
  VALIDATION_ERROR: 'Revise os dados da pessoa.',
};

export function teamErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? 'Não foi possível atualizar a equipe.';
}

export function roleLabel(role: string): string {
  return TEAM_ROLES.find((item) => item.value === role)?.label ?? role;
}

export function statusLabel(status: string): string {
  if (status === 'ACTIVE') {
    return 'Ativo';
  }
  if (status === 'DISABLED') {
    return 'Desabilitado';
  }
  return status;
}

export function roleDefaults(role: string): readonly string[] {
  return ROLE_DEFAULTS[role] ?? [];
}

export function isRoleDefault(role: string, permission: string): boolean {
  return roleDefaults(role).includes(permission);
}

export function overridesFor(
  role: string,
  enabled: readonly string[],
): { permission: string; granted: boolean }[] {
  const defaults = new Set(roleDefaults(role));
  const selected = new Set(enabled);
  return PERMISSIONS.flatMap((item) => {
    const on = selected.has(item.value);
    if (on === defaults.has(item.value)) {
      return [];
    }
    return [{ permission: item.value, granted: on }];
  });
}

export function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let body = '';
  for (const byte of bytes) {
    body += alphabet[byte % alphabet.length] ?? 'a';
  }
  return `Cia${body}7`;
}
