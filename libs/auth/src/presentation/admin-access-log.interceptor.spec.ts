import { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { AdminAccessLogInterceptor } from './admin-access-log.interceptor';

describe('AdminAccessLogInterceptor', () => {
  it('logs admin access at info with userId, tenantId and action', () => {
    const lines: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
      });
    const interceptor = new AdminAccessLogInterceptor();

    try {
      interceptor
        .intercept(
          context({
            method: 'POST',
            originalUrl: '/api/v1/admin/users?page=1',
            actor: {
              userId: 'user-a',
              tenantId: 'tenant-a',
              role: 'OWNER',
              storeId: 'store-a',
              permissions: [],
            },
            body: {
              email: 'ana@padaria.example',
              password: 'OwnerPassword1',
            },
          }),
          { handle: () => of({ email: 'ana@padaria.example' }) },
        )
        .subscribe();
    } finally {
      stdout.mockRestore();
    }

    const line = lines.find((item) => item.includes('admin access'));
    expect(line).toBeDefined();
    const parsed = JSON.parse(line ?? '{}') as {
      level: string;
      message: string;
    };
    expect(parsed.level).toBe('info');
    expect(JSON.parse(parsed.message)).toEqual({
      message: 'admin access',
      userId: 'user-a',
      tenantId: 'tenant-a',
      action: 'POST /api/v1/admin/users',
    });
    expect(line).not.toContain('ana@padaria.example');
    expect(line).not.toContain('OwnerPassword1');
  });

  it('does not log public routes', () => {
    const lines: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
      });
    const interceptor = new AdminAccessLogInterceptor();

    try {
      interceptor
        .intercept(
          context({
            method: 'GET',
            originalUrl: '/api/v1/public/store',
            actor: {
              userId: 'user-a',
              tenantId: 'tenant-a',
              role: 'OWNER',
              storeId: 'store-a',
              permissions: [],
            },
          }),
          { handle: () => of(null) },
        )
        .subscribe();
    } finally {
      stdout.mockRestore();
    }

    expect(lines.some((item) => item.includes('admin access'))).toBe(false);
  });
});

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
