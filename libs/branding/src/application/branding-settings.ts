import {
  discardStoredFile,
  FileInput,
  ImageKind,
  resolveStoredImage,
  StorageProvider,
  StoredFile,
  WarningLog,
} from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';
import { CurrentStore } from '@ciadelivery/stores';
import { BrandingView, defaultBranding } from '../domain/branding';
import { BrandingRepository } from '../domain/branding-repository';
import { requireActorStore } from './actor-store';

const IMAGE_FIELDS = {
  logos: 'logoUrl',
  favicons: 'faviconUrl',
  banners: 'bannerUrl',
} as const satisfies Record<Exclude<ImageKind, 'products'>, keyof BrandingView>;

export class GetBranding {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
    private readonly storage: StorageProvider,
  ) {}

  async execute(actor: RequestActor): Promise<BrandingView> {
    const store = await requireActorStore(actor, this.stores);
    const current =
      (await this.branding.findCurrent()) ?? defaultBranding(store.name);
    return presentBranding(current, this.storage);
  }
}

export class SaveBranding {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
    private readonly storage: StorageProvider,
  ) {}

  async execute(
    actor: RequestActor,
    draft: BrandingView,
  ): Promise<BrandingView> {
    await requireActorStore(actor, this.stores);
    const current = await this.branding.findCurrent();
    const saved = await this.branding.save({
      ...draft,
      logoUrl: current?.logoUrl ?? null,
      faviconUrl: current?.faviconUrl ?? null,
      bannerUrl: current?.bannerUrl ?? null,
    });
    return presentBranding(saved, this.storage);
  }
}

export class UploadBrandingImage {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
    private readonly storage: StorageProvider,
    private readonly log: WarningLog,
  ) {}

  async execute(
    actor: RequestActor,
    kind: keyof typeof IMAGE_FIELDS,
    file: FileInput,
  ): Promise<StoredFile> {
    const store = await requireActorStore(actor, this.stores);
    const current =
      (await this.branding.findCurrent()) ?? defaultBranding(store.name);
    const field = IMAGE_FIELDS[kind];
    const stored = await this.storage.upload({
      ...file,
      tenantId: store.tenantId,
      kind,
    });
    await this.branding.save({ ...current, [field]: stored.key });
    await discardStoredFile(
      this.storage,
      store.tenantId,
      current[field],
      stored.key,
      this.log,
    );
    return stored;
  }
}

export function presentBranding(
  branding: BrandingView,
  storage: StorageProvider,
): BrandingView {
  const publicUrl = (key: string): string => storage.publicUrl(key);
  return {
    ...branding,
    logoUrl: resolveStoredImage(branding.logoUrl, publicUrl),
    faviconUrl: resolveStoredImage(branding.faviconUrl, publicUrl),
    bannerUrl: resolveStoredImage(branding.bannerUrl, publicUrl),
  };
}
