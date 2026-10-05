import { assertLastOwnerRemains } from './last-owner';

describe('assertLastOwnerRemains', () => {
  it('refuses to disable the only active owner', () => {
    expect(() =>
      assertLastOwnerRemains({
        currentRole: 'OWNER',
        currentStatus: 'ACTIVE',
        nextStatus: 'DISABLED',
        activeOwnerCount: 1,
      }),
    ).toThrow(expect.objectContaining({ code: 'LAST_OWNER', statusCode: 409 }));
  });

  it('allows disabling an owner when another owner stays active', () => {
    expect(() =>
      assertLastOwnerRemains({
        currentRole: 'OWNER',
        currentStatus: 'ACTIVE',
        nextStatus: 'DISABLED',
        activeOwnerCount: 2,
      }),
    ).not.toThrow();
  });

  it('allows disabling an attendant', () => {
    expect(() =>
      assertLastOwnerRemains({
        currentRole: 'ATTENDANT',
        currentStatus: 'ACTIVE',
        nextStatus: 'DISABLED',
        activeOwnerCount: 1,
      }),
    ).not.toThrow();
  });
});
