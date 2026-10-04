import { JsonLogger, sanitizeLogValue } from '@ciadelivery/shared';
import { requestContext } from '@ciadelivery/shared';

describe('sanitizeLogValue', () => {
  it('redacts passwords, tokens, authorization and cookies', () => {
    expect(
      sanitizeLogValue({
        password: 'secret-password',
        token: 'secret-token',
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        name: 'Ada',
      }),
    ).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      authorization: '[redacted]',
      cookie: '[redacted]',
      name: 'Ada',
    });
  });

  it('does not log a login body', () => {
    expect(
      sanitizeLogValue({
        path: '/api/v1/auth/login',
        body: { email: 'ada@example.com', password: 'secret-password' },
      }),
    ).toEqual({
      path: '/api/v1/auth/login',
      body: '[redacted]',
    });
  });
});

describe('JsonLogger', () => {
  it('writes one json line with the request id', () => {
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    requestContext.run({ requestId: 'req-123' }, () => {
      new JsonLogger().log(
        { password: 'secret-password', event: 'ready' },
        'Health',
      );
    });

    const line = String(stdout.mock.calls[0]?.[0]);
    expect(line.endsWith('\n')).toBe(true);
    expect(line.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(line)).toMatchObject({
      level: 'info',
      requestId: 'req-123',
      context: 'Health',
    });
    expect(line).not.toContain('secret-password');
    expect(JSON.parse(line).timestamp).toEqual(expect.any(String));
    stdout.mockRestore();
  });
});
