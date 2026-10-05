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

export function canReadOrders(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('orders.read');
}

export function canReadCustomers(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('customers.read');
}

export function canOperateWhatsApp(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('whatsapp.operate');
}

export function canManageCatalog(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('catalog.manage');
}

export function canReadAudit(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('audit.read');
}

export function canReadReports(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('reports.read');
}

export function canManageUsers(
  user: { permissions: readonly string[] } | null,
): boolean {
  return user !== null && user.permissions.includes('users.manage');
}

export function isKitchen(
  user: { role: string; permissions: readonly string[] } | null,
): boolean {
  return user?.role === 'KITCHEN';
}

export function homePath(
  user: { role?: string; permissions: readonly string[] } | null,
): string {
  if (user?.role === 'KITCHEN') {
    return '/pedidos';
  }
  if (canReadOrders(user)) {
    return '/';
  }
  if (canConfigure(user)) {
    return '/configuracoes';
  }
  if (canManageCatalog(user)) {
    return '/cardapio';
  }
  return '/inicio';
}
