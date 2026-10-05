import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiUrl } from '../../core/api-url';
import { readErrorCode } from '../../core/api-error';
import {
  CONVERSATION_FEED,
  ConversationNotice,
} from './conversation-feed';

interface ConversationCard {
  id: string;
  maskedPhone: string;
  contactName: string | null;
  mode: string;
  lastMessageAt: string;
}

interface ConversationMessage {
  id: string;
  direction: 'IN' | 'OUT';
  author: string;
  body: string;
  status: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  contactPhone: string;
  contactName: string | null;
  mode: string;
}

interface ListResponse {
  data: ConversationCard[];
}

interface ThreadResponse {
  conversation: ConversationDetail;
  data: ConversationMessage[];
}

const ERRORS: Record<string, string> = {
  WHATSAPP_NOT_CONNECTED: 'Conecte o WhatsApp da loja antes de responder.',
  CONVERSATION_CLOSED: 'Esta conversa está encerrada.',
  CONVERSATION_NOT_FOUND: 'Conversa não encontrada.',
  VALIDATION_ERROR: 'Escreva uma mensagem de até 1000 caracteres.',
};

@Component({
  selector: 'admin-conversations-page',
  templateUrl: './conversations-page.html',
})
export class ConversationsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly feed = inject(CONVERSATION_FEED);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly conversations = signal<ConversationCard[]>([]);
  readonly selected = signal<ConversationDetail | null>(null);
  readonly messages = signal<ConversationMessage[]>([]);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly threadError = signal('');

  ngOnInit(): void {
    this.reload();
    this.feed
      .watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notice) => this.onNotice(notice));
  }

  reload(): void {
    this.loading.set(true);
    this.http
      .get<ListResponse>(apiUrl('/api/v1/admin/whatsapp/conversations'), {
        params: { page: '1', pageSize: '50' },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.conversations.set(page.data);
          this.loading.set(false);
          this.error.set('');
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Não foi possível carregar as conversas.');
        },
      });
  }

  open(id: string): void {
    this.threadError.set('');
    this.http
      .get<ThreadResponse>(
        apiUrl(`/api/v1/admin/whatsapp/conversations/${id}/messages`),
        { params: { page: '1', pageSize: '100' } },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (thread) => {
          this.selected.set(thread.conversation);
          this.messages.set(thread.data);
        },
        error: () => {
          this.threadError.set('Não foi possível abrir a conversa.');
        },
      });
  }

  back(): void {
    this.selected.set(null);
    this.messages.set([]);
    this.draft.set('');
    this.threadError.set('');
  }

  onDraft(value: string): void {
    this.draft.set(value);
  }

  send(): void {
    const conversation = this.selected();
    const body = this.draft().trim();
    if (conversation === null || body.length === 0 || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.threadError.set('');
    this.http
      .post<ConversationMessage>(
        apiUrl(`/api/v1/admin/whatsapp/conversations/${conversation.id}/messages`),
        { body },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          this.messages.update((items) =>
            items.some((item) => item.id === message.id)
              ? items
              : [...items, message],
          );
          this.draft.set('');
          this.sending.set(false);
          this.bump(conversation.id, message.createdAt);
        },
        error: (error: unknown) => {
          this.sending.set(false);
          const code = readErrorCode(error);
          this.threadError.set(ERRORS[code] ?? 'Não foi possível enviar.');
        },
      });
  }

  close(): void {
    const conversation = this.selected();
    if (conversation === null) {
      return;
    }
    if (!window.confirm('Encerrar esta conversa?')) {
      return;
    }
    this.http
      .post<ConversationCard>(
        apiUrl(`/api/v1/admin/whatsapp/conversations/${conversation.id}/close`),
        {},
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.selected.update((current) =>
            current === null ? current : { ...current, mode: updated.mode },
          );
          this.conversations.update((items) =>
            items.map((item) =>
              item.id === updated.id ? { ...item, mode: updated.mode } : item,
            ),
          );
        },
        error: () => {
          this.threadError.set('Não foi possível encerrar a conversa.');
        },
      });
  }

  authorLabel(author: string): string {
    if (author === 'CUSTOMER') {
      return 'Cliente';
    }
    if (author === 'USER') {
      return 'Loja';
    }
    return 'Sistema';
  }

  private onNotice(notice: ConversationNotice): void {
    const known = this.conversations().some(
      (item) => item.id === notice.conversationId,
    );
    if (!known) {
      this.reload();
    } else {
      this.bump(notice.conversationId, notice.createdAt);
    }
    if (this.selected()?.id !== notice.conversationId) {
      return;
    }
    if (this.messages().some((item) => item.id === notice.messageId)) {
      return;
    }
    this.messages.update((items) => [
      ...items,
      {
        id: notice.messageId,
        direction: notice.direction === 'OUT' ? 'OUT' : 'IN',
        author: notice.author,
        body: notice.body,
        status: 'SENT',
        createdAt: notice.createdAt,
      },
    ]);
  }

  private bump(id: string, lastMessageAt: string): void {
    this.conversations.update((items) => {
      const current = items.find((item) => item.id === id);
      if (current === undefined) {
        return items;
      }
      return [
        { ...current, lastMessageAt },
        ...items.filter((item) => item.id !== id),
      ];
    });
  }
}
