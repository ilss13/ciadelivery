import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore } from '@ciadelivery/stores';
import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  BrandingDraft,
  BrandingView,
  normalizeBranding,
} from '../domain/branding';
import { BrandingRepository } from '../domain/branding-repository';
import { BrandingConfigEntity } from './branding-config.entity';
import { requireCurrentStore } from './current-store-scope';

@Injectable()
export class TypeOrmBranding implements BrandingRepository {
  constructor(
    private readonly database: DatabaseReady,
    @Inject(CURRENT_STORE) private readonly stores: CurrentStore,
  ) {}

  async findCurrent(): Promise<BrandingView | null> {
    const store = await requireCurrentStore(this.stores);
    const dataSource = await this.database.ensure();
    const row = await dataSource.manager.findOne(BrandingConfigEntity, {
      where: { tenantId: store.tenantId, storeId: store.id },
    });
    return row === null ? null : toView(row);
  }

  async save(
    draft: BrandingDraft,
    tx?: TransactionContext,
  ): Promise<BrandingView> {
    const store = await requireCurrentStore(this.stores);
    const branding = normalizeBranding(draft);
    const manager =
      tx === undefined
        ? (await this.database.ensure()).manager
        : (tx as unknown as EntityManager);
    const existing = await manager.findOne(BrandingConfigEntity, {
      where: { tenantId: store.tenantId, storeId: store.id },
    });
    const now = new Date();
    if (existing === null) {
      await manager.insert(BrandingConfigEntity, {
        id: randomUUID(),
        tenantId: store.tenantId,
        storeId: store.id,
        ...branding,
        createdAt: now,
        updatedAt: now,
      });
      return branding;
    }

    await manager.update(
      BrandingConfigEntity,
      { id: existing.id, tenantId: store.tenantId, storeId: store.id },
      { ...branding, updatedAt: now },
    );
    return branding;
  }
}

function toView(row: BrandingConfigEntity): BrandingView {
  return {
    displayName: row.displayName,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    bannerUrl: row.bannerUrl,
    primaryColor: row.primaryColor.trim().toUpperCase(),
    secondaryColor: row.secondaryColor.trim().toUpperCase(),
    accentColor: row.accentColor.trim().toUpperCase(),
    fontFamily: row.fontFamily,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    instagramUrl: row.instagramUrl,
    facebookUrl: row.facebookUrl,
    websiteUrl: row.websiteUrl,
    contactEmail: row.contactEmail,
    whatsappPhone: row.whatsappPhone,
  };
}
