import { PreviewToolResult } from './conversation-tools';

export interface ConversationOrderInput {
  tenantId: string;
  storeId: string;
  conversationId: string;
  contactPhone: string;
  contactName: string | null;
}

export type ConversationOrderResult =
  | { outcome: 'MISSING' }
  | { outcome: 'EXPIRED'; repeated: boolean }
  | { outcome: 'PAYMENT_REQUIRED' }
  | { outcome: 'TOOL_FAILED' }
  | { outcome: 'PRICE_CHANGED'; preview: PreviewToolResult }
  | {
      outcome: 'CREATED';
      orderId: string;
      orderNumber: number;
      trackingPath: string;
      customerName: string;
    };

export interface ConversationOrders {
  confirm(input: ConversationOrderInput): Promise<ConversationOrderResult>;
  cancel(input: ConversationOrderInput): Promise<boolean>;
}

export const CONVERSATION_ORDERS = Symbol('CONVERSATION_ORDERS');
