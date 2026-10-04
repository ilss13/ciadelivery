import { RequestActor } from '@ciadelivery/users';
import { CurrentStore } from '@ciadelivery/stores';
import { BrandingView, defaultBranding } from '../domain/branding';
import { BrandingRepository } from '../domain/branding-repository';
import { requireActorStore } from './actor-store';

export class GetBranding {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
  ) {}

  async execute(actor: RequestActor): Promise<BrandingView> {
    const store = await requireActorStore(actor, this.stores);
    return (await this.branding.findCurrent()) ?? defaultBranding(store.name);
  }
}

export class SaveBranding {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
  ) {}

  async execute(
    actor: RequestActor,
    draft: BrandingView,
  ): Promise<BrandingView> {
    await requireActorStore(actor, this.stores);
    return this.branding.save(draft);
  }
}
