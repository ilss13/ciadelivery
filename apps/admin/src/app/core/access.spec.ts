import { canConfigure, homePath } from './access';

describe('access', () => {
  it('hides store settings from an attendant', () => {
    const attendant = { permissions: ['orders.read'] };
    expect(canConfigure(attendant)).toBe(false);
    expect(homePath(attendant)).toBe('/inicio');
  });

  it('sends the owner to store settings', () => {
    const owner = { permissions: ['store.configure'] };
    expect(canConfigure(owner)).toBe(true);
    expect(homePath(owner)).toBe('/configuracoes');
  });
});
