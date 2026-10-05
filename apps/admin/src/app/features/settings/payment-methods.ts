import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiUrl } from '../../core/api-url';
import { paymentErrorMessage } from './payment-messages';

interface PaymentMethod {
  code: string;
  label: string;
  instructions: string | null;
  enabled: boolean;
  sortOrder: number;
}

@Component({
  selector: 'admin-payment-methods',
  templateUrl: './payment-methods.html',
})
export class PaymentMethodsSection implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly methods = signal<PaymentMethod[]>([]);
  private readonly dirty = signal(false);

  ngOnInit(): void {
    this.http
      .get<{ methods: PaymentMethod[] }>(
        apiUrl('/api/v1/admin/payment-methods'),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => {
          this.methods.set(loaded.methods);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(paymentErrorMessage(error));
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  setEnabled(code: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    this.methods.update((methods) =>
      methods.map((method) =>
        method.code === code ? { ...method, enabled: input.checked } : method,
      ),
    );
    this.dirty.set(true);
    this.notice.set('');
  }

  setInstructions(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }
    const instructions = input.value.trim();
    this.methods.update((methods) =>
      methods.map((method) =>
        method.code === 'PIX_MANUAL'
          ? { ...method, instructions: instructions.length === 0 ? null : instructions }
          : method,
      ),
    );
    this.dirty.set(true);
    this.notice.set('');
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    const methods = this.methods();
    if (!methods.some((method) => method.enabled)) {
      const confirmed = window.confirm(
        'Nenhuma forma de pagamento ficará ativa. A loja precisa de pelo menos uma. Deseja continuar?',
      );
      if (!confirmed) {
        return;
      }
    }

    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .put<{ methods: PaymentMethod[] }>(
        apiUrl('/api/v1/admin/payment-methods'),
        {
          methods: methods.map((method) => ({
            code: method.code,
            label: method.label,
            instructions: method.instructions,
            enabled: method.enabled,
          })),
        },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.methods.set(saved.methods);
          this.dirty.set(false);
          this.saving.set(false);
          this.notice.set('Formas de pagamento salvas.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(paymentErrorMessage(error));
        },
      });
  }
}
