import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { apiUrl } from '../../core/api-url';
import {
  auditActionLabel,
  auditErrorMessage,
  formatAuditDate,
  formatChanges,
} from './audit-messages';

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditPageBody {
  data: AuditRow[];
  meta: { page: number; totalPages: number; total: number };
}

@Component({
  selector: 'admin-audit-page',
  imports: [ReactiveFormsModule],
  templateUrl: './audit-page.html',
})
export class AuditPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.formBuilder.nonNullable.group({
    action: '',
    entityType: '',
    from: '',
    to: '',
  });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly rows = signal<AuditRow[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly loaded = signal(false);

  ngOnInit(): void {
    this.load(1);
  }

  search(): void {
    this.load(1);
  }

  previous(): void {
    this.load(this.page() - 1);
  }

  next(): void {
    this.load(this.page() + 1);
  }

  actionLabel(action: string): string {
    return auditActionLabel(action);
  }

  when(iso: string): string {
    return formatAuditDate(iso);
  }

  changes(value: unknown): string {
    return formatChanges(value);
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    const filters = this.form.getRawValue();
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (filters.action.trim().length > 0) {
      params = params.set('action', filters.action.trim());
    }
    if (filters.entityType.trim().length > 0) {
      params = params.set('entityType', filters.entityType.trim());
    }
    if (filters.from.length > 0) {
      params = params.set('from', new Date(filters.from).toISOString());
    }
    if (filters.to.length > 0) {
      params = params.set('to', new Date(filters.to).toISOString());
    }
    this.http
      .get<AuditPageBody>(apiUrl('/api/v1/admin/audit-logs'), { params })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.rows.set(body.data);
          this.page.set(body.meta.page);
          this.totalPages.set(body.meta.totalPages);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.rows.set([]);
          this.error.set(auditErrorMessage(error));
        },
      });
  }
}
