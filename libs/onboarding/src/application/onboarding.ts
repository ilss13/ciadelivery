import { DomainException } from '@ciadelivery/shared';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { Checklist } from '../domain/checklist';
import {
  LOCKED_STEP_CODES,
  MANUAL_COMPLETE_CODES,
  OnboardingCode,
  blockingPublishCodes,
  isOnboardingCode,
  nextPendingCode,
} from '../domain/steps';

export interface OnboardingActor {
  userId: string;
  tenantId: string | null;
  permissions: readonly string[];
}

export interface OnboardingStepView {
  code: OnboardingCode;
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  doneAt: string | null;
  doneBy: string | null;
  note: string | null;
}

export interface OnboardingChecklistView {
  published: boolean;
  steps: OnboardingStepView[];
  nextCode: OnboardingCode | null;
  blockingCodes: OnboardingCode[];
}

export class ReadOnboarding {
  constructor(private readonly checklist: Checklist) {}

  async forActor(actor: OnboardingActor): Promise<OnboardingChecklistView> {
    return this.forTenant(requireTenant(actor));
  }

  async forTenant(tenantId: string): Promise<OnboardingChecklistView> {
    const publication = await this.checklist.publication(tenantId);
    if (publication === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }
    const steps = await this.checklist.list(tenantId);
    const activeProducts = await this.checklist.countActiveProducts(
      tenantId,
      publication.storeId,
    );
    return present(publication.published, steps, activeProducts);
  }
}

export class ChangeOnboarding {
  constructor(
    private readonly checklist: Checklist,
    private readonly unitOfWork: UnitOfWork,
    private readonly read: ReadOnboarding,
  ) {}

  async complete(
    actor: OnboardingActor,
    code: string,
    note: string | null,
  ): Promise<OnboardingChecklistView> {
    const tenantId = requireTenant(actor);
    const step = requireKnownCode(code);
    if (
      !(MANUAL_COMPLETE_CODES as readonly OnboardingCode[]).includes(step)
    ) {
      throw new DomainException(
        'ONBOARDING_STEP_NOT_MANUAL',
        'This onboarding step is completed by saving the related settings',
        409,
      );
    }
    const saved = await this.checklist.changeStatus({
      tenantId,
      code: step,
      status: 'DONE',
      actorId: actor.userId,
      note,
    });
    if (!saved) {
      throw new DomainException(
        'ONBOARDING_STEP_NOT_FOUND',
        'The onboarding step was not found',
        404,
      );
    }
    return this.read.forTenant(tenantId);
  }

  async skip(
    actor: OnboardingActor,
    code: string,
    note: string | null,
  ): Promise<OnboardingChecklistView> {
    const tenantId = requireTenant(actor);
    const step = requireKnownCode(code);
    if ((LOCKED_STEP_CODES as readonly OnboardingCode[]).includes(step)) {
      throw new DomainException(
        'ONBOARDING_STEP_LOCKED',
        'This onboarding step cannot be skipped',
        409,
      );
    }
    const current = (await this.checklist.list(tenantId)).find(
      (item) => item.code === step,
    );
    if (current?.status === 'DONE') {
      throw new DomainException(
        'ONBOARDING_STEP_DONE',
        'This onboarding step is already done',
        409,
      );
    }
    const saved = await this.checklist.changeStatus({
      tenantId,
      code: step,
      status: 'SKIPPED',
      actorId: actor.userId,
      note,
    });
    if (!saved) {
      throw new DomainException(
        'ONBOARDING_STEP_NOT_FOUND',
        'The onboarding step was not found',
        404,
      );
    }
    return this.read.forTenant(tenantId);
  }

  async publish(actor: OnboardingActor): Promise<OnboardingChecklistView> {
    const tenantId = requireConfigure(actor);
    await this.unitOfWork.run(async (tx) => {
      const publication = await this.checklist.publication(tenantId, tx);
      if (publication === null) {
        throw new DomainException(
          'STORE_NOT_FOUND',
          'The store was not found',
          404,
        );
      }
      if (publication.published) {
        return;
      }
      const steps = await this.checklist.list(tenantId, tx);
      const activeProducts = await this.checklist.countActiveProducts(
        tenantId,
        publication.storeId,
        tx,
      );
      const blocking = blockingPublishCodes(steps, activeProducts);
      if (blocking.length > 0) {
        throw new DomainException(
          'ONBOARDING_INCOMPLETE',
          'The store is missing required onboarding steps',
          409,
          { codes: blocking },
        );
      }
      await this.checklist.setPublished(
        tenantId,
        publication.storeId,
        true,
        tx,
      );
      await this.checklist.markDone(
        { tenantId, code: 'publish_store', actorId: actor.userId },
        tx,
      );
    });
    return this.read.forTenant(tenantId);
  }

  async unpublish(actor: OnboardingActor): Promise<OnboardingChecklistView> {
    const tenantId = requireConfigure(actor);
    await this.unitOfWork.run(async (tx) => {
      const publication = await this.checklist.publication(tenantId, tx);
      if (publication === null) {
        throw new DomainException(
          'STORE_NOT_FOUND',
          'The store was not found',
          404,
        );
      }
      await this.checklist.setPublished(
        tenantId,
        publication.storeId,
        false,
        tx,
      );
      await this.checklist.changeStatus(
        {
          tenantId,
          code: 'publish_store',
          status: 'PENDING',
          actorId: null,
          note: null,
        },
        tx,
      );
    });
    return this.read.forTenant(tenantId);
  }
}

function present(
  published: boolean,
  steps: Awaited<ReturnType<Checklist['list']>>,
  activeProductCount: number,
): OnboardingChecklistView {
  return {
    published,
    steps: steps.map((step) => ({
      code: step.code,
      status: step.status,
      doneAt: step.doneAt === null ? null : step.doneAt.toISOString(),
      doneBy: step.doneBy,
      note: step.note,
    })),
    nextCode: nextPendingCode(steps),
    blockingCodes: blockingPublishCodes(steps, activeProductCount),
  };
}

function requireTenant(actor: OnboardingActor): string {
  if (actor.userId.length === 0) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }
  if (actor.tenantId === null) {
    throw new DomainException('FORBIDDEN', 'The permission is required', 403);
  }
  return actor.tenantId;
}

function requireConfigure(actor: OnboardingActor): string {
  const tenantId = requireTenant(actor);
  if (!actor.permissions.includes('store.configure')) {
    throw new DomainException('FORBIDDEN', 'The permission is required', 403);
  }
  return tenantId;
}

function requireKnownCode(code: string): OnboardingCode {
  if (!isOnboardingCode(code)) {
    throw new DomainException(
      'ONBOARDING_STEP_NOT_FOUND',
      'The onboarding step was not found',
      404,
    );
  }
  return code;
}
