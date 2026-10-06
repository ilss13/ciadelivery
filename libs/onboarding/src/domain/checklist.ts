import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { OnboardingCode, OnboardingStatus } from './steps';

export interface ChecklistMark {
  tenantId: string;
  code: string;
  actorId: string | null;
}

export interface ChecklistStatusChange {
  tenantId: string;
  code: OnboardingCode;
  status: OnboardingStatus;
  actorId: string | null;
  note: string | null;
}

export interface StoredOnboardingStep {
  code: OnboardingCode;
  status: OnboardingStatus;
  doneAt: Date | null;
  doneBy: string | null;
  note: string | null;
}

export interface StorePublication {
  storeId: string;
  published: boolean;
}

export interface Checklist {
  seed(tenantId: string, tx: TransactionContext): Promise<void>;
  markDone(mark: ChecklistMark, tx?: TransactionContext): Promise<void>;
  list(
    tenantId: string,
    tx?: TransactionContext,
  ): Promise<StoredOnboardingStep[]>;
  changeStatus(
    change: ChecklistStatusChange,
    tx?: TransactionContext,
  ): Promise<boolean>;
  publication(
    tenantId: string,
    tx?: TransactionContext,
  ): Promise<StorePublication | null>;
  setPublished(
    tenantId: string,
    storeId: string,
    published: boolean,
    tx: TransactionContext,
  ): Promise<void>;
  countActiveProducts(
    tenantId: string,
    storeId: string,
    tx?: TransactionContext,
  ): Promise<number>;
}

export const CHECKLIST = Symbol('CHECKLIST');
