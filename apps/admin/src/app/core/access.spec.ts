import {
  canConfigure,
  canManageCatalog,
  canManageUsers,
  canReadAudit,
  canReadCustomers,
  canReadOrders,
  canReadReports,
  homePath,
} from './access';

describe('access', () => {
  it('hides store settings from an attendant', () => {
    const attendant = { permissions: ['orders.read'], role: 'ATTENDANT' };
    expect(canConfigure(attendant)).toBe(false);
    expect(canManageUsers(attendant)).toBe(false);
    expect(canReadAudit(attendant)).toBe(false);
    expect(canReadReports(attendant)).toBe(false);
    expect(canManageCatalog(attendant)).toBe(false);
    expect(homePath(attendant)).toBe('/');
  });

  it('opens the dashboard for whoever operates orders', () => {
    const owner = {
      role: 'OWNER',
      permissions: ['store.configure', 'catalog.manage', 'orders.read', 'users.manage'],
    };
    expect(canConfigure(owner)).toBe(true);
    expect(canManageUsers(owner)).toBe(true);
    expect(homePath(owner)).toBe('/');
  });

  it('sends the kitchen straight to the order board', () => {
    const kitchen = {
      role: 'KITCHEN',
      permissions: ['orders.read', 'orders.prepare'],
    };
    expect(homePath(kitchen)).toBe('/pedidos');
  });

  it('lets an attendant open customers', () => {
    expect(canReadCustomers({ permissions: ['customers.read'] })).toBe(true);
    expect(canReadOrders({ permissions: ['orders.read'] })).toBe(true);
    expect(canReadCustomers({ permissions: ['orders.read'] })).toBe(false);
    expect(canConfigure({ permissions: ['customers.read'] })).toBe(false);
  });

  it('sends a manager to the menu', () => {
    const manager = { permissions: ['catalog.manage'] };
    expect(canConfigure(manager)).toBe(false);
    expect(canManageCatalog(manager)).toBe(true);
    expect(homePath(manager)).toBe('/cardapio');
    expect(canReadAudit(manager)).toBe(false);
  });

  it('lets the owner open the audit trail', () => {
    expect(canReadAudit({ permissions: ['audit.read'] })).toBe(true);
  });

  it('lets the owner and the manager open reports', () => {
    expect(canReadReports({ permissions: ['reports.read'] })).toBe(true);
    expect(canReadReports({ permissions: ['orders.read'] })).toBe(false);
  });
});
