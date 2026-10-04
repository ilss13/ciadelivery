import { DomainException } from '@ciadelivery/shared';
import {
  assertAssignablePermissions,
  effectivePermissions,
} from './permissions';

describe('effectivePermissions', () => {
  it('applies grants and revokes on top of the role default', () => {
    expect(
      effectivePermissions('ATTENDANT', [
        { permission: 'catalog.manage', granted: true },
        { permission: 'orders.accept', granted: false },
      ]),
    ).toEqual([
      'catalog.manage',
      'customers.read',
      'orders.assign_courier',
      'orders.prepare',
      'orders.read',
      'whatsapp.operate',
    ]);
  });

  it('gives SUPER_ADMIN no tenant permissions', () => {
    expect(
      effectivePermissions('SUPER_ADMIN', [
        { permission: 'users.manage', granted: true },
      ]),
    ).toEqual([]);
  });
});

describe('assertAssignablePermissions', () => {
  const manager = {
    role: 'MANAGER' as const,
    permissions: effectivePermissions('MANAGER', [
      { permission: 'users.manage', granted: true },
    ]),
  };

  it('lets the actor grant a permission they hold', () => {
    expect(() =>
      assertAssignablePermissions(manager, 'ATTENDANT', [
        { permission: 'catalog.manage', granted: true },
      ]),
    ).not.toThrow();
  });

  it('refuses a permission the actor does not hold', () => {
    expect(() =>
      assertAssignablePermissions(manager, 'OWNER', []),
    ).toThrow(DomainException);
    try {
      assertAssignablePermissions(manager, 'ATTENDANT', [
        { permission: 'audit.read', granted: true },
      ]);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'PERMISSION_NOT_HELD',
        statusCode: 403,
      });
    }
  });

  it('lets an owner assign a permission missing from their own set', () => {
    expect(() =>
      assertAssignablePermissions(
        {
          role: 'OWNER',
          permissions: effectivePermissions('OWNER', [
            { permission: 'audit.read', granted: false },
          ]),
        },
        'OWNER',
        [],
      ),
    ).not.toThrow();
  });
});
