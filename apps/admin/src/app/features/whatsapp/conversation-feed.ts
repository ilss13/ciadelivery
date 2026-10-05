import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io } from 'socket.io-client';
import { apiUrl } from '../../core/api-url';
import { SessionService } from '../../core/session.service';

export interface ConversationNotice {
  conversationId: string;
  messageId: string;
  body: string;
  author: string;
  direction: string;
  createdAt: string;
}

export interface ConversationFeed {
  watch(): Observable<ConversationNotice>;
}

export const CONVERSATION_FEED = new InjectionToken<ConversationFeed>(
  'CONVERSATION_FEED',
);

@Injectable({ providedIn: 'root' })
export class SocketConversationFeed implements ConversationFeed {
  private readonly session = inject(SessionService);

  watch(): Observable<ConversationNotice> {
    return new Observable((subscriber) => {
      const token = this.session.accessToken();
      if (token === null) {
        subscriber.complete();
        return;
      }
      const socket = io(apiUrl('/realtime'), { auth: { token } });
      socket.on('conversation.message_received', (payload: unknown) => {
        const notice = readNotice(payload);
        if (notice !== null) {
          subscriber.next(notice);
        }
      });
      return () => {
        socket.close();
      };
    });
  }
}

function readNotice(payload: unknown): ConversationNotice | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const conversationId = text(record['conversationId']);
  const messageId = text(record['messageId']);
  const body = typeof record['body'] === 'string' ? record['body'] : null;
  const author = text(record['author']);
  const direction = text(record['direction']);
  const createdAt = text(record['createdAt']);
  if (
    conversationId === null ||
    messageId === null ||
    body === null ||
    author === null ||
    direction === null ||
    createdAt === null
  ) {
    return null;
  }
  return { conversationId, messageId, body, author, direction, createdAt };
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value;
}
