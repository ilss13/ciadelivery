import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { ConversationMode, MessageAuthor } from '../domain/conversation';
import { WhatsAppConnectionStatus } from '../domain/connections.port';
import { OrderTemplateKey } from '../domain/order-templates';
import { OutboundMessageStatus } from '../domain/outbound-messages.port';

@Entity({ name: 'whatsapp_connections' })
export class WhatsAppConnectionEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ type: 'varchar', length: 20 })
  provider!: 'META_CLOUD';

  @Column({ name: 'phone_number', type: 'varchar', length: 32 })
  phoneNumber!: string;

  @Column({ name: 'business_account_id', type: 'varchar', length: 64 })
  businessAccountId!: string;

  @Column({ name: 'phone_number_id', type: 'varchar', length: 64 })
  phoneNumberId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: WhatsAppConnectionStatus;

  @Column({ name: 'encrypted_credentials', type: 'text', nullable: true })
  encryptedCredentials!: string | null;

  @Column({ name: 'connected_at', type: 'datetime', precision: 3, nullable: true })
  connectedAt!: Date | null;

  @Column({
    name: 'disconnected_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  disconnectedAt!: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'whatsapp_webhook_events' })
export class WhatsAppWebhookEventEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 255 })
  externalId!: string;

  @Column({ type: 'json' })
  payload!: object;

  @Column({ name: 'received_at', type: 'datetime', precision: 3 })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'datetime', precision: 3, nullable: true })
  processedAt!: Date | null;
}

@Entity({ name: 'message_templates' })
@Unique('uq_message_templates_tenant_key', ['tenantId', 'key'])
export class MessageTemplateEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ type: 'varchar', length: 64 })
  key!: OrderTemplateKey;

  @Column({ type: 'varchar', length: 16, default: 'pt_BR' })
  language!: string;

  @Column({ name: 'meta_template_name', type: 'varchar', length: 64 })
  metaTemplateName!: string;

  @Column({ type: 'boolean' })
  enabled!: boolean;
}

@Entity({ name: 'conversations' })
export class ConversationEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'store_id', type: 'char', length: 36 })
  storeId!: string;

  @Column({ name: 'customer_id', type: 'char', length: 36, nullable: true })
  customerId!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 32 })
  contactPhone!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 120, nullable: true })
  contactName!: string | null;

  @Column({ type: 'varchar', length: 16 })
  mode!: ConversationMode;

  @Column({ name: 'linked_order_id', type: 'char', length: 36, nullable: true })
  linkedOrderId!: string | null;

  @Column({ name: 'last_message_at', type: 'datetime', precision: 3 })
  lastMessageAt!: Date;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'whatsapp_messages' })
@Index('idx_whatsapp_messages_template', ['tenantId', 'templateKey', 'createdAt'])
export class WhatsAppMessageEntity {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36 })
  tenantId!: string;

  @Column({ name: 'conversation_id', type: 'char', length: 36, nullable: true })
  conversationId!: string | null;

  @Column({ type: 'varchar', length: 8 })
  direction!: 'IN' | 'OUT';

  @Column({ type: 'varchar', length: 16, default: 'SYSTEM' })
  author!: MessageAuthor;

  @Column({ name: 'to_phone', type: 'varchar', length: 32 })
  toPhone!: string;

  @Column({ name: 'template_key', type: 'varchar', length: 64, nullable: true })
  templateKey!: OrderTemplateKey | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: OutboundMessageStatus;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 128, nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'event_id', type: 'char', length: 36, nullable: true })
  eventId!: string | null;

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId!: string | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
