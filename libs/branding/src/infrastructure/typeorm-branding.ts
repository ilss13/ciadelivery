import { randomUUID } from 'node:crypto';
import { DatabaseReady } from '@ciadelivery/shared';
import { CURRENT_STORE, CurrentStore } from '@ciadelivery/stores';
import { Inject, Injectable } from '@nestjs/common';
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

  async save(draft: BrandingDraft): Promise<BrandingView> {
    const store = await requireCurrentStore(this.stores);
    const branding = normalizeBranding(draft);
    const dataSource = await this.database.ensure();
    const existing = await dataSource.manager.findOne(BrandingConfigEntity, {
      where: { tenantId: store.tenantId, storeId: store.id },
    });
    const now = new Date();
    if (existing === null) {
      await dataSource.manager.insert(BrandingConfigEntity, {
        id: randomUUID(),
        tenantId: store.tenantId,
        storeId: store.id,
        ...branding,
        createdAt: now,
        updatedAt: now,
      });
      return branding;
    }

    await dataSource.manager.update(
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
