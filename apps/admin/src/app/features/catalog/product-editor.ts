import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { apiUrl } from '../../core/api-url';
import { centsToReais, reaisToCents } from '../settings/money';
import { imageFileMessage, imageUploadError, mediaUrl } from '../../shared/image-file';
import { catalogErrorMessage } from './catalog-messages';
import { reorder } from './catalog-order';

interface Category {
  id: string;
  name: string;
}

interface OptionItem {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  sortOrder: number;
}

interface OptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: OptionItem[];
}

interface ProductDetail {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  imageUrl: string | null;
  active: boolean;
  available: boolean;
  optionGroups: OptionGroup[];
}

interface Page<T> {
  data: T[];
}

@Component({
  selector: 'admin-product-editor',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-editor.html',
})
export class ProductEditor implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly categories = signal<Category[]>([]);
  readonly productId = signal<string | null>(null);
  readonly groups = signal<OptionGroup[]>([]);
  readonly imageUrl = signal<string | null>(null);
  readonly imageError = signal('');
  readonly uploadingImage = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    categoryId: ['', Validators.required],
    name: ['', Validators.required],
    description: '',
    price: ['0,00', Validators.required],
    sku: '',
    active: true,
    available: true,
  });

  readonly groupForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    requiredOne: false,
    minSelect: 0,
    maxSelect: 1,
  });

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('productId');
    const categoryId = this.route.snapshot.queryParamMap.get('categoria');
    this.productId.set(productId);
    const categories = this.http.get<Page<Category>>(
      apiUrl('/api/v1/admin/categories'),
      { params: { page: 1, pageSize: 100 } },
    );
    if (productId === null) {
      categories.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (loaded) => {
          this.categories.set(loaded.data);
          if (categoryId !== null) {
            this.form.controls.categoryId.setValue(categoryId);
          }
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(catalogErrorMessage(error));
          this.loading.set(false);
        },
      });
      return;
    }

    forkJoin({
      categories,
      product: this.http.get<ProductDetail>(
        apiUrl(`/api/v1/admin/products/${productId}`),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => {
          this.categories.set(loaded.categories.data);
          this.applyProduct(loaded.product);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(catalogErrorMessage(error));
          this.loading.set(false);
        },
      });
  }

  previewUrl(): string | null {
    return mediaUrl(this.imageUrl());
  }

  onImageSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const message = imageFileMessage(file);
    if (message !== null) {
      this.imageError.set(message);
      return;
    }
    const productId = this.productId();
    if (productId === null) {
      this.imageError.set('Salve o produto antes de enviar a foto.');
      return;
    }
    this.imageError.set('');
    this.uploadingImage.set(true);
    const body = new FormData();
    body.append('file', file);
    this.http
      .post<{ url: string }>(
        apiUrl(`/api/v1/admin/products/${productId}/image`),
        body,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stored) => {
          this.uploadingImage.set(false);
          this.imageUrl.set(stored.url);
          this.notice.set('Foto enviada.');
        },
        error: (error: unknown) => {
          this.uploadingImage.set(false);
          this.imageError.set(imageUploadError(error));
        },
      });
  }

  removeImage(): void {
    const productId = this.productId();
    if (productId === null || !window.confirm('Remover a foto deste produto?')) {
      return;
    }
    this.uploadingImage.set(true);
    this.http
      .delete(apiUrl(`/api/v1/admin/products/${productId}/image`))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.uploadingImage.set(false);
          this.imageUrl.set(null);
          this.notice.set('Foto removida.');
        },
        error: (error: unknown) => {
          this.uploadingImage.set(false);
          this.imageError.set(imageUploadError(error));
        },
      });
  }

  priceLabel(cents: number): string {
    return centsToReais(cents);
  }

  categoryQuery(): { categoria: string } | null {
    const categoryId = this.form.controls.categoryId.value;
    return categoryId.length > 0 ? { categoria: categoryId } : null;
  }

  saveProduct(): void {
    const priceCents = reaisToCents(this.form.controls.price.value);
    if (this.form.invalid || priceCents === null || this.saving()) {
      this.form.markAllAsTouched();
      if (priceCents === null) {
        this.error.set('Informe o preço em reais, como 39,90.');
      }
      return;
    }
    const value = this.form.getRawValue();
    const body = {
      categoryId: value.categoryId,
      name: value.name.trim(),
      description: value.description.trim() || null,
      priceCents,
      sku: value.sku.trim() || null,
      active: value.active,
      available: value.available,
    };
    this.saving.set(true);
    this.error.set('');
    const productId = this.productId();
    const request =
      productId === null
        ? this.http.post<ProductDetail>(apiUrl('/api/v1/admin/products'), body)
        : this.http.patch<ProductDetail>(
            apiUrl(`/api/v1/admin/products/${productId}`),
            body,
          );
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.notice.set('Produto salvo.');
        if (productId === null) {
          void this.router.navigate(['/cardapio/produtos', saved.id], {
            replaceUrl: true,
          });
          return;
        }
        this.applyProduct(saved);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(catalogErrorMessage(error));
      },
    });
  }

  addGroup(): void {
    const productId = this.productId();
    if (productId === null || this.groupForm.invalid || this.saving()) {
      this.groupForm.markAllAsTouched();
      return;
    }
    const value = this.groupForm.getRawValue();
    const minSelect = value.requiredOne ? 1 : Number(value.minSelect);
    const maxSelect = value.requiredOne ? 1 : Number(value.maxSelect);
    this.saving.set(true);
    this.http
      .post(apiUrl(`/api/v1/admin/products/${productId}/option-groups`), {
        name: value.name.trim(),
        minSelect,
        maxSelect,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.groupForm.reset({
            name: '',
            requiredOne: false,
            minSelect: 0,
            maxSelect: 1,
          });
          this.saving.set(false);
          this.notice.set('Grupo adicionado.');
          this.refreshProduct();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(catalogErrorMessage(error));
        },
      });
  }

  moveGroup(index: number, direction: -1 | 1): void {
    const next = reorder(this.groups(), index, direction);
    if (next === null) {
      return;
    }
    const productId = this.productId();
    if (productId === null) {
      return;
    }
    const changed = next.filter((group) => {
      const before = this.groups().find((item) => item.id === group.id);
      return before?.sortOrder !== group.sortOrder;
    });
    forkJoin(
      changed.map((group) =>
        this.http.patch(
          apiUrl(
            `/api/v1/admin/products/${productId}/option-groups/${group.id}`,
          ),
          { sortOrder: group.sortOrder },
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshProduct(),
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  removeGroup(group: OptionGroup): void {
    const productId = this.productId();
    if (productId === null) {
      return;
    }
    if (!window.confirm(`Excluir o grupo ${group.name} e as opções dele?`)) {
      return;
    }
    this.http
      .delete(
        apiUrl(`/api/v1/admin/products/${productId}/option-groups/${group.id}`),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('Grupo excluído.');
          this.refreshProduct();
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  addOption(groupId: string, name: string, price: string, available: boolean): void {
    const productId = this.productId();
    const priceCents = reaisToCents(price);
    if (productId === null || name.trim().length === 0 || priceCents === null) {
      this.error.set('Informe o nome da opção e um preço válido.');
      return;
    }
    this.http
      .post(
        apiUrl(
          `/api/v1/admin/products/${productId}/option-groups/${groupId}/options`,
        ),
        { name: name.trim(), priceCents, available },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('Opção adicionada.');
          this.error.set('');
          this.refreshProduct();
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  removeOption(groupId: string, option: OptionItem): void {
    if (!window.confirm(`Excluir a opção ${option.name}?`)) {
      return;
    }
    this.http
      .delete(
        apiUrl(`/api/v1/admin/option-groups/${groupId}/options/${option.id}`),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('Opção excluída.');
          this.refreshProduct();
        },
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }

  private applyProduct(product: ProductDetail): void {
    this.productId.set(product.id);
    this.groups.set(product.optionGroups);
    this.imageUrl.set(product.imageUrl);
    this.form.setValue({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description ?? '',
      price: centsToReais(product.priceCents),
      sku: product.sku ?? '',
      active: product.active,
      available: product.available,
    });
  }

  private refreshProduct(): void {
    const productId = this.productId();
    if (productId === null) {
      return;
    }
    this.http
      .get<ProductDetail>(apiUrl(`/api/v1/admin/products/${productId}`))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => this.applyProduct(product),
        error: (error: unknown) => this.error.set(catalogErrorMessage(error)),
      });
  }
}
