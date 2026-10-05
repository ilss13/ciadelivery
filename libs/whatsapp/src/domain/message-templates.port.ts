import { OrderTemplateKey } from './order-templates';

export interface MessageTemplateRecord {
  id: string;
  tenantId: string;
  key: OrderTemplateKey;
  language: string;
  metaTemplateName: string;
  enabled: boolean;
}

export interface MessageTemplates {
  listForTenant(tenantId: string): Promise<MessageTemplateRecord[]>;
  find(
    tenantId: string,
    key: OrderTemplateKey,
  ): Promise<MessageTemplateRecord | null>;
  insertIfAbsent(template: MessageTemplateRecord): Promise<void>;
  setEnabled(
    tenantId: string,
    key: OrderTemplateKey,
    enabled: boolean,
  ): Promise<boolean>;
}

export const MESSAGE_TEMPLATES = Symbol('MESSAGE_TEMPLATES');
