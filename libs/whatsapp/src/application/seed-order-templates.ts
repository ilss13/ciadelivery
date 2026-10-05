import { randomUUID } from 'node:crypto';
import { MessageTemplates } from '../domain/message-templates.port';
import { ORDER_TEMPLATE_KEYS } from '../domain/order-templates';

export async function seedOrderTemplates(
  templates: MessageTemplates,
  tenantId: string,
): Promise<void> {
  for (const key of ORDER_TEMPLATE_KEYS) {
    await templates.insertIfAbsent({
      id: randomUUID(),
      tenantId,
      key,
      language: 'pt_BR',
      metaTemplateName: key,
      enabled: true,
    });
  }
}
