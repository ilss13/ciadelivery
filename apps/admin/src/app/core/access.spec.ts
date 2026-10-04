import { canConfigure, canManageCatalog, homePath } from './access';

describe('access', () => {
  it('hides store settings from an attendant', () => {
    const attendant = { permissions: ['orders.read'] };
    expect(canConfigure(attendant)).toBe(false);
    expect(canManageCatalog(attendant)).toBe(false);
    expect(homePath(attendant)).toBe('/inicio');
  });

  it('sends the owner to store settings', () => {
    const owner = { permissions: ['store.configure', 'catalog.manage'] };
    expect(canConfigure(owner)).toBe(true);
    expect(canManageCatalog(owner)).toBe(true);
    expect(homePath(owner)).toBe('/configuracoes');
  });

  it('sends a manager to the menu', () => {
    const manager = { permissions: ['catalog.manage'] };
    expect(canConfigure(manager)).toBe(false);
    expect(canManageCatalog(manager)).toBe(true);
    expect(homePath(manager)).toBe('/cardapio');
  });
});
