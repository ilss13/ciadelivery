import { refreshCookieOptions } from './cookies';

describe('refresh cookie', () => {
  it('is HttpOnly and Lax, and Secure outside local', () => {
    expect(refreshCookieOptions('local')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/auth',
    });
    expect(refreshCookieOptions('development').secure).toBe(true);
    expect(refreshCookieOptions('staging').secure).toBe(true);
    expect(refreshCookieOptions('production').secure).toBe(true);
  });
});
