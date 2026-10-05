import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiUrl } from '../../core/api-url';
import {
  PERMISSIONS,
  TEAM_ROLES,
  isRoleDefault,
  overridesFor,
  roleDefaults,
  roleLabel,
  statusLabel,
  teamErrorMessage,
  temporaryPassword,
} from './team-messages';

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: string[];
}

interface UserPage {
  data: TeamUser[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

@Component({
  selector: 'admin-team-page',
  imports: [ReactiveFormsModule],
  templateUrl: './team-page.html',
})
export class TeamPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly roles = TEAM_ROLES;
  readonly permissions = PERMISSIONS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly users = signal<TeamUser[]>([]);
  readonly revealedPassword = signal('');
  readonly editingId = signal<string | null>(null);
  readonly enabled = signal<string[]>([]);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['ATTENDANT', Validators.required],
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    role: ['ATTENDANT', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  roleName(role: string): string {
    return roleLabel(role);
  }

  statusName(status: string): string {
    return statusLabel(status);
  }

  standard(permission: string): boolean {
    return isRoleDefault(this.editForm.controls.role.value, permission);
  }

  permissionOn(permission: string): boolean {
    return this.enabled().includes(permission);
  }

  create(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const password = temporaryPassword();
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .post<TeamUser>(apiUrl('/api/v1/admin/users'), {
        name: value.name.trim(),
        email: value.email.trim(),
        password,
        role: value.role,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.revealedPassword.set(password);
          this.form.reset({ name: '', email: '', role: 'ATTENDANT' });
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(teamErrorMessage(error));
        },
      });
  }

  hidePassword(): void {
    this.revealedPassword.set('');
  }

  startEdit(user: TeamUser): void {
    this.editingId.set(user.id);
    this.editForm.setValue({ role: user.role });
    this.enabled.set([...user.permissions]);
    this.error.set('');
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  changeRole(role: string): void {
    this.editForm.controls.role.setValue(role);
    this.enabled.set([...roleDefaults(role)]);
  }

  togglePermission(permission: string, checked: boolean): void {
    const next = new Set(this.enabled());
    if (checked) {
      next.add(permission);
    } else {
      next.delete(permission);
    }
    this.enabled.set([...next]);
  }

  saveEdit(user: TeamUser): void {
    if (this.saving()) {
      return;
    }
    const role = this.editForm.controls.role.value;
    this.saving.set(true);
    this.error.set('');
    this.http
      .patch<TeamUser>(apiUrl(`/api/v1/admin/users/${user.id}`), {
        role,
        permissionOverrides: overridesFor(role, this.enabled()),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          this.notice.set('Pessoa atualizada.');
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(teamErrorMessage(error));
        },
      });
  }

  disable(user: TeamUser): void {
    if (
      !window.confirm(
        `Desabilitar ${user.name}? A pessoa deixa de entrar no painel.`,
      )
    ) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.http
      .patch(apiUrl(`/api/v1/admin/users/${user.id}`), { status: 'DISABLED' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notice.set('Pessoa desabilitada.');
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(teamErrorMessage(error));
        },
      });
  }

  private load(): void {
    this.http
      .get<UserPage>(apiUrl('/api/v1/admin/users'), {
        params: { page: 1, pageSize: 100 },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.users.set(page.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(teamErrorMessage(error));
          this.loading.set(false);
        },
      });
  }
}
