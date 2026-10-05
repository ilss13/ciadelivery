import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TeamPage } from './team-page';
import { overridesFor, roleDefaults, temporaryPassword } from './team-messages';

describe('team access', () => {
  it('keeps super admin out of the assignable roles and records only real overrides', () => {
    expect(roleDefaults('KITCHEN')).toEqual(['orders.read', 'orders.prepare']);
    expect(roleDefaults('OWNER').join(' ')).not.toContain('SUPER_ADMIN');
    expect(overridesFor('KITCHEN', ['orders.read', 'orders.prepare'])).toEqual(
      [],
    );
    expect(overridesFor('KITCHEN', ['orders.read'])).toEqual([
      { permission: 'orders.prepare', granted: false },
    ]);
  });

  it('builds a temporary password with a letter and a digit', () => {
    const password = temporaryPassword();
    expect(password.length).toBeGreaterThanOrEqual(10);
    expect(password).toMatch(/\p{L}/u);
    expect(password).toMatch(/\d/);
  });
});

describe('TeamPage', () => {
  it('shows a temporary password once and asks before disabling', async () => {
    const fixture = create();
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushUsers(http, [owner()]);
    await fixture.whenStable();
    fixture.detectChanges();

    page.form.setValue({
      name: 'Caixa',
      email: 'caixa@example.com',
      role: 'ATTENDANT',
    });
    page.create();
    const created = http.expectOne(
      (candidate) =>
        candidate.method === 'POST' && candidate.url.includes('/api/v1/admin/users'),
    );
    const password = (created.request.body as { password: string }).password;
    expect((created.request.body as { role: string }).role).toBe('ATTENDANT');
    created.flush({
      id: 'user-2',
      name: 'Caixa',
      email: 'caixa@example.com',
      role: 'ATTENDANT',
      status: 'ACTIVE',
      permissions: ['orders.read'],
    });
    flushUsers(http, [owner(), attendant()]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(password);

    page.hidePassword();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(password);

    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    page.disable(attendant());
    expect(confirm).toHaveBeenCalled();
    http.expectNone(
      (candidate) =>
        candidate.method === 'PATCH' &&
        candidate.url.includes('/api/v1/admin/users/user-2'),
    );
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(TeamPage);
}

function flushUsers(
  http: HttpTestingController,
  data: ReturnType<typeof owner>[],
): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.includes('/api/v1/admin/users') &&
        candidate.params.get('pageSize') === '100',
    )
    .flush({
    data,
    meta: { page: 1, pageSize: 100, total: data.length, totalPages: 1 },
  });
}

function owner() {
  return {
    id: 'user-1',
    name: 'Olga',
    email: 'olga@example.com',
    role: 'OWNER',
    status: 'ACTIVE',
    permissions: ['users.manage', 'orders.read'],
  };
}

function attendant() {
  return {
    id: 'user-2',
    name: 'Caixa',
    email: 'caixa@example.com',
    role: 'ATTENDANT',
    status: 'ACTIVE',
    permissions: ['orders.read'],
  };
}
