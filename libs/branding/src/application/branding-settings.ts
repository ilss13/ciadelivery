import { AuditLogs, recordChanged } from '@ciadelivery/audit';
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
import { TransactionContext, UnitOfWork } from '@ciadelivery/tenancy/domain';
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

type StepMarker = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

const idleSteps: StepMarker = {
  async markDone(): Promise<void> {
    return undefined;
  },
};

export class SaveBranding {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
    private readonly storage: StorageProvider,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
    private readonly steps: StepMarker = idleSteps,
  ) {}

  async execute(
    actor: RequestActor,
    draft: BrandingView,
  ): Promise<BrandingView> {
    const store = await requireActorStore(actor, this.stores);
    const current =
      (await this.branding.findCurrent()) ?? defaultBranding(store.name);
    const nextDraft = {
      ...draft,
      logoUrl: current.logoUrl,
      faviconUrl: current.faviconUrl,
      bannerUrl: current.bannerUrl,
    };
    const saved = await this.unitOfWork.run(async (tx) => {
      const stored = await this.branding.save(nextDraft, tx);
      await recordChanged(this.audit, tx, {
        tenantId: store.tenantId,
        actor,
        action: 'branding.updated',
        entityType: 'branding',
        entityId: store.id,
        before: { ...current },
        after: { ...stored },
      });
      await this.steps.markDone(
        {
          tenantId: store.tenantId,
          code: 'configure_branding',
          actorId: actor.userId,
        },
        tx,
      );
      return stored;
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
    private readonly steps: StepMarker = idleSteps,
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
    await this.steps.markDone({
      tenantId: store.tenantId,
      code: 'configure_branding',
      actorId: actor.userId,
    });
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
