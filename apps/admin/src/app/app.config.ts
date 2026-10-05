import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import {
  HttpOrdersBoardStore,
  ORDERS_BOARD_STORE,
} from './features/orders/orders-board.store';
import {
  CONVERSATION_FEED,
  SocketConversationFeed,
} from './features/whatsapp/conversation-feed';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: ORDERS_BOARD_STORE, useExisting: HttpOrdersBoardStore },
    { provide: CONVERSATION_FEED, useExisting: SocketConversationFeed },
  ],
};
