import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, forkJoin, of, startWith, Subject, switchMap } from 'rxjs';
import { apiUrl } from '../../core/api-url';
import { centsToReais } from '../settings/money';
import {
  catalogErrorMessage,
  catalogImportErrorMessage,
} from './catalog-messages';
import { reorder } from './catalog-order';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
}

interface Product {
  id: string;
  categoryId: string;
  name: string;
  priceCents: number;
  active: boolean;
  available: boolean;
  sortOrder: number;
}

interface Page<T> {
  data: T[];
  meta: { total: number };
}

interface CatalogImportError {
  line: number;
  code: string;
  message: string;
}

interface CatalogImportSummary {
  products: number;
}

@Component({
  selector: 'admin-catalog-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './catalog-page.html',
})
export class CatalogPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload$ = new Subject<void>();

  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[] | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly importFile = signal<File | null>(null);
  readonly importing = signal(false);
  readonly importErrors = signal<CatalogImportError[]>([]);

  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: '',
    active: true,
  });

  readonly editForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: '',
    active: true,
  });

  ngOnInit(): void {
    combineLatest([
      this.route.queryParamMap,
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([params]) => {
          const categoryId = params.get('categoria');
          this.categoryId.set(categoryId);
          this.loading.set(true);
          this.error.set('');
          const categories = this.http.get<Page<Category>>(
            apiUrl('/api/v1/admin/categories'),
            { params: { page: 1, pageSize: 100 } },
          );
          if (categoryId === null) {
            return forkJoin({ categories, products: of(null) });
          }
          return forkJoin({
            categories,
            products: this.http.get<Page<Product>>(
              apiUrl('/api/v1/admin/products'),
              {
                params: new HttpParams()
                  .set('page', '1')
                  .set('pageSize', '100')
                  .set('categoryId', categoryId),
              },
            ),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (loaded) => {
          this.categories.set(loaded.categories.data);
          this.products.set(loaded.products?.data ?? null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(catalogErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  price(cents: number): string {
    return centsToReais(cents);
  }

  importErrorMessage(code: string): string {
    return catalogImportErrorMessage(code);
  }

  selectImportFile(event: Event): void {
    const input = event.target;
    this.importFile.set(
      input instanceof HTMLInputElement ? (input.files?.item(0) ?? null) : null,
    );
    this.importErrors.set([]);
  }

  importCsv(): void {
    const file = this.importFile();
    if (file === null || this.importing()) {
      this.error.set('Selecione um arquivo CSV.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    this.importing.set(true);
    this.error.set('');
    this.importErrors.set([]);
    this.http
      .post<CatalogImportSummary>(
        apiUrl('/api/v1/admin/catalog/import'),
        body,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.importing.set(false);
          this.importFile.set(null);
          this.notice.set(
            `${summary.products} ${summary.products === 1 ? 'produto importado' : 'produtos importados'}.`,
          );
          this.reload();
        },
        error: (error: unknown) => {
          this.importing.set(false);
          const details = importErrorDetails(error);
          this.importErrors.set(details);
          if (details.length === 0) {
            this.error.set(catalogErrorMessage(error));
          }
        },
      });
  }

  downloadTemplate(): void {
    this.http
      .get(apiUrl('/api/v1/admin/catalog/import-template'), {
        responseType: 'blob',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'modelo-cardapio.csv';
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  selectedCategory(): Category | undefined {
    return this.categories().find((category) => category.id === this.categoryId());
  }

  openCategory(id: string): void {
    void this.router.navigate(['/cardapio'], {
      queryParams: { categoria: id },
    });
  }

  createCategory(): void {
    if (this.createForm.invalid || this.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.saving.set(true);
    this.http
      .post(apiUrl('/api/v1/admin/categories'), {
        name: value.name.trim(),
        description: value.description.trim() || null,
        active: value.active,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.createForm.reset({ name: '', description: '', active: true });
          this.saving.set(false);
          this.notice.set('Categoria cadastrada.');
          this.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(catalogErrorMessage(error));
        },
      });
  }

  startEdit(category: Category): void {
    this.editingId.set(category.id);
    this.editForm.setValue({
      name: category.name,
      description: category.description ?? '',
      active: category.active,
    });
  }

  saveCategory(id: string): void {
    if (this.editForm.invalid || this.saving()) {
      return;
    }
    const value = this.editForm.getRawValue();
    this.saving.set(true);
    this.http
      .patch(apiUrl(`/api/v1/admin/categories/${id}`), {
        name: value.name.trim(),
        description: value.description.trim() || null,
        active: value.active,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editingId.set(null);
          this.saving.set(false);
          this.notice.set('Categoria atualizada.');
          this.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(catalogErrorMessage(error));
        },
      });
  }

  removeCategory(category: Category): void {
    if (!window.confirm(`Excluir a categoria ${category.name}?`)) {
      return;
    }
    this.http
      .delete(apiUrl(`/api/v1/admin/categories/${category.id}`))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('Categoria excluída.');
          if (this.categoryId() === category.id) {
            void this.router.navigate(['/cardapio']);
            return;
          }
          this.reload();
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  moveCategory(index: number, direction: -1 | 1): void {
    const next = reorder(this.categories(), index, direction);
    if (next === null) {
      return;
    }
    this.persistOrder(
      this.categories(),
      next,
      (id) => apiUrl(`/api/v1/admin/categories/${id}`),
    );
  }

  removeProduct(product: Product): void {
    if (!window.confirm(`Excluir o produto ${product.name}?`)) {
      return;
    }
    this.http
      .delete(apiUrl(`/api/v1/admin/products/${product.id}`))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('Produto excluído.');
          this.reload();
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  moveProduct(index: number, direction: -1 | 1): void {
    const current = this.products();
    if (current === null) {
      return;
    }
    const next = reorder(current, index, direction);
    if (next === null) {
      return;
    }
    this.persistOrder(
      current,
      next,
      (id) => apiUrl(`/api/v1/admin/products/${id}`),
    );
  }

  reload(): void {
    this.reload$.next();
  }

  private persistOrder<T extends { id: string; sortOrder: number }>(
    previous: readonly T[],
    next: readonly T[],
    url: (id: string) => string,
  ): void {
    const changed = next.filter((item) => {
      const before = previous.find((candidate) => candidate.id === item.id);
      return before?.sortOrder !== item.sortOrder;
    });
    if (changed.length === 0) {
      return;
    }
    forkJoin(
      changed.map((item) =>
        this.http.patch(url(item.id), { sortOrder: item.sortOrder }),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.reload(),
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }
}

function importErrorDetails(error: unknown): CatalogImportError[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }
  const body = error.error as
    | { error?: { details?: unknown } }
    | null;
  const details = body?.error?.details;
  if (!Array.isArray(details)) {
    return [];
  }
  return details.filter((item): item is CatalogImportError => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const value = item as Record<string, unknown>;
    return (
      typeof value['line'] === 'number' &&
      typeof value['code'] === 'string' &&
      typeof value['message'] === 'string'
    );
  });
}
