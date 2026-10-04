export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: readonly string[];
}

export function canConfigure(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('store.configure');
}

export function canManageCatalog(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('catalog.manage');
}

export function homePath(
  user: { permissions: readonly string[] } | null,
): string {
  if (canConfigure(user)) {
    return '/configuracoes';
  }
  if (canManageCatalog(user)) {
    return '/cardapio';
  }
  return '/inicio';
}
