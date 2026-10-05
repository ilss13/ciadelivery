import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { readErrorCode } from '../../core/api-error';
import { apiUrl } from '../../core/api-url';
import { whatsappCodeMessage, whatsappErrorMessage } from './whatsapp-messages';

interface TemplateError {
  maskedPhone: string;
  message: string;
}

interface WhatsAppTemplate {
  key: string;
  enabled: boolean;
  persisted: boolean;
  lastError: TemplateError | null;
}

interface SystemSend {
  id: string;
  templateKey: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  createdAt: string;
  error: string | null;
}

const SEND_STATUS_LABELS: Record<SystemSend['status'], string> = {
  QUEUED: 'Na fila',
  SENT: 'Enviada',
  FAILED: 'Falhou',
  SKIPPED: 'Não enviada',
};

const TEMPLATE_LABELS: Record<string, string> = {
  order_received: 'Pedido recebido',
  order_accepted: 'Pedido aceito',
  order_rejected: 'Pedido recusado',
  order_preparing: 'Pedido em preparo',
  order_ready: 'Pedido pronto',
  order_out_for_delivery: 'Saiu para entrega',
  order_delivered: 'Pedido entregue',
  order_cancelled: 'Pedido cancelado',
};

interface WhatsAppConnection {
  phoneNumber: string;
  businessAccountId: string;
  phoneNumberId: string;
  status: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  credentialsHint: string | null;
}

const STATUS_LABELS: Record<WhatsAppConnection['status'], string> = {
  PENDING: 'Pendente',
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  ERROR: 'Erro',
};

@Component({
  selector: 'admin-whatsapp-settings',
  templateUrl: './whatsapp-settings.html',
  styles: [
    ':host { display: block; margin-top: 0.75rem; }',
    '.templates, .sends { display: grid; gap: 0.75rem; margin-top: 0.75rem; }',
    '.templates .check { grid-template-columns: auto 1fr; align-items: center; }',
    '.sends { list-style: none; padding: 0; }',
    '.sends li { display: grid; gap: 0.25rem; overflow-wrap: anywhere; }',
  ],
})
export class WhatsAppSettingsSection implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly connection = signal<WhatsAppConnection | null>(null);
  readonly phoneNumber = signal('');
  readonly businessAccountId = signal('');
  readonly phoneNumberId = signal('');
  readonly accessToken = signal('');
  readonly templates = signal<WhatsAppTemplate[]>([]);
  readonly sends = signal<SystemSend[]>([]);
  private readonly dirty = signal(false);

  readonly statusLabel = STATUS_LABELS;
  readonly sendStatusLabel = SEND_STATUS_LABELS;
  readonly templateLabel = TEMPLATE_LABELS;

  ngOnInit(): void {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  setPhoneNumber(event: Event): void {
    this.phoneNumber.set(text(event));
    this.touch();
  }

  setBusinessAccountId(event: Event): void {
    this.businessAccountId.set(text(event));
    this.touch();
  }

  setPhoneNumberId(event: Event): void {
    this.phoneNumberId.set(text(event));
    this.touch();
  }

  setAccessToken(event: Event): void {
    this.accessToken.set(text(event));
    this.touch();
  }

  connect(): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .post<WhatsAppConnection>(apiUrl('/api/v1/admin/whatsapp/connect'), {
        phoneNumber: this.phoneNumber().trim(),
        businessAccountId: this.businessAccountId().trim(),
        phoneNumberId: this.phoneNumberId().trim(),
        accessToken: this.accessToken(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connection) => {
          this.apply(connection);
          this.accessToken.set('');
          this.dirty.set(false);
          this.saving.set(false);
          this.notice.set('Número oficial conectado.');
          this.loadTemplates();
          this.loadSends();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(whatsappErrorMessage(error));
        },
      });
  }

  disconnect(): void {
    if (
      this.connection() === null ||
      this.saving() ||
      !window.confirm(
        'Desconectar o WhatsApp desta loja? O token deixa de ser guardado.',
      )
    ) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .delete(apiUrl('/api/v1/admin/whatsapp/connection'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const current = this.connection();
          if (current !== null) {
            this.connection.set({
              ...current,
              status: 'DISCONNECTED',
              credentialsHint: null,
            });
          }
          this.saving.set(false);
          this.notice.set('WhatsApp desconectado.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(whatsappErrorMessage(error));
        },
      });
  }

  toggleTemplate(item: WhatsAppTemplate, event: Event): void {
    if (!item.persisted || this.saving()) {
      return;
    }
    const enabled = (event.target as HTMLInputElement).checked;
    this.saving.set(true);
    this.error.set('');
    this.http
      .patch<WhatsAppTemplate>(
        apiUrl(`/api/v1/admin/whatsapp/templates/${item.key}`),
        { enabled },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.templates.update((current) =>
            current.map((template) =>
              template.key === updated.key ? updated : template,
            ),
          );
          this.saving.set(false);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(whatsappErrorMessage(error));
          this.loadTemplates();
        },
      });
  }

  errorText(message: string): string {
    return whatsappCodeMessage(message);
  }

  sendTitle(item: SystemSend): string {
    if (item.templateKey === null) {
      return 'Mensagem do sistema';
    }
    return this.templateLabel[item.templateKey] ?? item.templateKey;
  }

  formatWhen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private load(): void {
    this.http
      .get<WhatsAppConnection>(apiUrl('/api/v1/admin/whatsapp/connection'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connection) => {
          this.apply(connection);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (readErrorCode(error) === 'WHATSAPP_CONNECTION_NOT_FOUND') {
            return;
          }
          this.error.set(whatsappErrorMessage(error));
        },
      });
    this.loadTemplates();
    this.loadSends();
  }

  private loadTemplates(): void {
    this.http
      .get<{ data: WhatsAppTemplate[] }>(
        apiUrl('/api/v1/admin/whatsapp/templates'),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.templates.set(response.data),
        error: () => this.templates.set([]),
      });
  }

  private loadSends(): void {
    this.http
      .get<{ data: SystemSend[] }>(apiUrl('/api/v1/admin/whatsapp/sends'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.sends.set(response.data.slice(0, 50)),
        error: () => this.sends.set([]),
      });
  }

  private apply(connection: WhatsAppConnection): void {
    this.connection.set(connection);
    this.phoneNumber.set(connection.phoneNumber);
    this.businessAccountId.set(connection.businessAccountId);
    this.phoneNumberId.set(connection.phoneNumberId);
  }

  private touch(): void {
    this.dirty.set(true);
  }
}

function text(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
