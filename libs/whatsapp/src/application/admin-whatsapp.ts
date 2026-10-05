import { randomUUID } from 'node:crypto';
import { actorTypeOf, AuditLogs, recordAudit, recordChanged } from '@ciadelivery/audit';
import { DomainException, JsonLogger } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import {
  credentialsHint,
  decodeCredentialsKey,
  decryptCredentials,
  encryptCredentials,
} from '../domain/credentials-cipher';
import {
  WhatsAppConnectionRecord,
  WhatsAppConnections,
} from '../domain/connections.port';
import { MessageTemplates } from '../domain/message-templates.port';
import {
  ORDER_TEMPLATE_KEYS,
  OrderTemplateKey,
  isOrderTemplateKey,
  maskPhone,
} from '../domain/order-templates';
import {
  OutboundMessageStatus,
  OutboundMessages,
} from '../domain/outbound-messages.port';
import { shortSendError } from '../domain/send-log';
import { WhatsAppPhoneCheck } from '../domain/whatsapp-provider';
import { seedOrderTemplates } from './seed-order-templates';

export interface ConnectWhatsAppInput {
  phoneNumber: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface WhatsAppTemplateErrorView {
  maskedPhone: string;
  message: string;
}

export interface WhatsAppTemplateView {
  key: OrderTemplateKey;
  language: string;
  metaTemplateName: string;
  enabled: boolean;
  persisted: boolean;
  lastError: WhatsAppTemplateErrorView | null;
}

export interface WhatsAppSendView {
  id: string;
  templateKey: OrderTemplateKey | null;
  status: OutboundMessageStatus;
  createdAt: string;
  error: string | null;
}

export interface WhatsAppConnectionView {
  id: string;
  provider: 'META_CLOUD';
  phoneNumber: string;
  businessAccountId: string;
  phoneNumberId: string;
  status: WhatsAppConnectionRecord['status'];
  credentialsHint: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export class AdminWhatsApp {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly connections: WhatsAppConnections,
    private readonly templates: MessageTemplates,
    private readonly messages: OutboundMessages,
    private readonly stores: CurrentStore,
    private readonly phoneCheck: WhatsAppPhoneCheck,
    private readonly encryptionKey: string,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
  ) {}

  async getConnection(actor: RequestActor): Promise<WhatsAppConnectionView> {
    const store = await this.requireStore(actor);
    const connection = await this.connections.findForStore(store.tenantId, store.id);
    if (connection === null) {
      throw new DomainException(
        'WHATSAPP_CONNECTION_NOT_FOUND',
        'The WhatsApp connection was not found',
        404,
      );
    }
    return this.toView(connection);
  }

  async connect(
    actor: RequestActor,
    input: ConnectWhatsAppInput,
  ): Promise<WhatsAppConnectionView> {
    const store = await this.requireStore(actor);
    const key = this.requireKey();
    await this.phoneCheck.assertPhoneNumber({
      phoneNumberId: input.phoneNumberId,
      accessToken: input.accessToken,
    });

    const taken = await this.connections.findConnectedByPhoneNumberId(
      input.phoneNumberId,
    );
    if (
      taken !== null &&
      (taken.storeId !== store.id || taken.tenantId !== store.tenantId)
    ) {
      throw new DomainException(
        'WHATSAPP_PHONE_IN_USE',
        'This WhatsApp number is already connected to another store',
        409,
      );
    }

    const current = await this.connections.findForStore(store.tenantId, store.id);
    const now = new Date();
    const connection: WhatsAppConnectionRecord = {
      id: current?.id ?? randomUUID(),
      tenantId: store.tenantId,
      storeId: store.id,
      provider: 'META_CLOUD',
      phoneNumber: input.phoneNumber.trim(),
      businessAccountId: input.businessAccountId.trim(),
      phoneNumberId: input.phoneNumberId.trim(),
      status: 'CONNECTED',
      encryptedCredentials: encryptCredentials(input.accessToken, key),
      connectedAt: now,
      disconnectedAt: null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    await this.unitOfWork.run(async (tx) => {
      await this.connections.save(connection, tx);
      const after = {
        status: connection.status,
        phoneNumberId: connection.phoneNumberId,
      };
      if (current === null) {
        await recordAudit(this.audit, tx, {
          tenantId: store.tenantId,
          actorId: actor.userId,
          actorType: actorTypeOf(actor.role),
          action: 'whatsapp.connected',
          entityType: 'whatsapp_connection',
          entityId: connection.id,
          before: null,
          changes: after,
        });
        return;
      }
      await recordChanged(this.audit, tx, {
        tenantId: store.tenantId,
        actor,
        action: 'whatsapp.connected',
        entityType: 'whatsapp_connection',
        entityId: connection.id,
        before: {
          status: current.status,
          phoneNumberId: current.phoneNumberId,
        },
        after,
      });
    });
    await seedOrderTemplates(this.templates, store.tenantId);
    this.logger.log(
      `WhatsApp connected for store ${store.id}`,
      'AdminWhatsApp',
    );
    return this.toView(connection, input.accessToken);
  }

  async listTemplates(actor: RequestActor): Promise<WhatsAppTemplateView[]> {
    const store = await this.requireStore(actor);
    const rows = await this.templates.listForTenant(store.tenantId);
    const views: WhatsAppTemplateView[] = [];
    for (const key of ORDER_TEMPLATE_KEYS) {
      const row = rows.find((item) => item.key === key && item.tenantId === store.tenantId);
      const failure =
        row === undefined
          ? null
          : await this.messages.latestFailure(store.tenantId, key);
      views.push({
        key,
        language: row?.language ?? 'pt_BR',
        metaTemplateName: row?.metaTemplateName ?? key,
        enabled: row?.enabled ?? false,
        persisted: row !== undefined,
        lastError:
          failure === null
            ? null
            : {
                maskedPhone: maskPhone(failure.toPhone),
                message: failure.lastError,
              },
      });
    }
    return views;
  }

  async listSends(
    actor: RequestActor,
  ): Promise<{ data: WhatsAppSendView[] }> {
    const store = await this.requireStore(actor);
    const rows = await this.messages.listRecentSystem(store.tenantId, 50);
    return {
      data: rows.map((row) => ({
        id: row.id,
        templateKey: row.templateKey,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        error: shortSendError(row.lastError),
      })),
    };
  }

  async setTemplateEnabled(
    actor: RequestActor,
    key: string,
    enabled: boolean,
  ): Promise<WhatsAppTemplateView> {
    const store = await this.requireStore(actor);
    if (!isOrderTemplateKey(key)) {
      throw new DomainException(
        'WHATSAPP_TEMPLATE_UNKNOWN',
        'The WhatsApp template is unknown',
        400,
      );
    }
    const updated = await this.templates.setEnabled(store.tenantId, key, enabled);
    if (!updated) {
      throw new DomainException(
        'WHATSAPP_TEMPLATE_NOT_FOUND',
        'The WhatsApp template was not found',
        404,
      );
    }
    const listed = await this.listTemplates(actor);
    const view = listed.find((item) => item.key === key);
    if (view === undefined) {
      throw new DomainException(
        'WHATSAPP_TEMPLATE_NOT_FOUND',
        'The WhatsApp template was not found',
        404,
      );
    }
    this.logger.log(
      `WhatsApp template ${key} enabled=${enabled} for store ${store.id}`,
      'AdminWhatsApp',
    );
    return view;
  }

  async disconnect(actor: RequestActor): Promise<void> {
    const store = await this.requireStore(actor);
    const current = await this.connections.findForStore(store.tenantId, store.id);
    if (current === null) {
      throw new DomainException(
        'WHATSAPP_CONNECTION_NOT_FOUND',
        'The WhatsApp connection was not found',
        404,
      );
    }

    const now = new Date();
    await this.unitOfWork.run(async (tx) => {
      await this.connections.save(
        {
          ...current,
          status: 'DISCONNECTED',
          encryptedCredentials: null,
          disconnectedAt: now,
          updatedAt: now,
        },
        tx,
      );
      await recordChanged(this.audit, tx, {
        tenantId: store.tenantId,
        actor,
        action: 'whatsapp.disconnected',
        entityType: 'whatsapp_connection',
        entityId: current.id,
        before: { status: current.status, phoneNumberId: current.phoneNumberId },
        after: { status: 'DISCONNECTED', phoneNumberId: current.phoneNumberId },
      });
    });
    this.logger.log(
      `WhatsApp disconnected for store ${store.id}`,
      'AdminWhatsApp',
    );
  }

  private toView(
    connection: WhatsAppConnectionRecord,
    knownToken?: string,
  ): WhatsAppConnectionView {
    return {
      id: connection.id,
      provider: connection.provider,
      phoneNumber: connection.phoneNumber,
      businessAccountId: connection.businessAccountId,
      phoneNumberId: connection.phoneNumberId,
      status: connection.status,
      credentialsHint: this.hint(connection, knownToken),
      connectedAt: toIso(connection.connectedAt),
      disconnectedAt: toIso(connection.disconnectedAt),
    };
  }

  private hint(
    connection: WhatsAppConnectionRecord,
    knownToken?: string,
  ): string | null {
    if (knownToken !== undefined) {
      return credentialsHint(knownToken);
    }
    if (connection.encryptedCredentials === null) {
      return null;
    }
    const key = decodeCredentialsKey(this.encryptionKey);
    if (key === null) {
      return null;
    }
    try {
      return credentialsHint(
        decryptCredentials(connection.encryptedCredentials, key),
      );
    } catch {
      this.logger.warn(
        `WhatsApp credentials could not be read for store ${connection.storeId}`,
        'AdminWhatsApp',
      );
      return null;
    }
  }

  private requireKey(): Buffer {
    const key = decodeCredentialsKey(this.encryptionKey);
    if (key === null) {
      throw new DomainException(
        'WHATSAPP_ENCRYPTION_UNAVAILABLE',
        'Credential encryption is not configured',
        503,
      );
    }
    return key;
  }

  private async requireStore(actor: RequestActor) {
    if (actor.tenantId === null || actor.storeId === null) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const store = await this.stores.findForCurrentTenant();
    if (
      store === null ||
      store.tenantId !== actor.tenantId ||
      store.id !== actor.storeId
    ) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    return store;
  }
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
