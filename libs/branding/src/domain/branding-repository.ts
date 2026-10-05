import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { BrandingDraft, BrandingView } from './branding';

export interface BrandingRepository {
  findCurrent(): Promise<BrandingView | null>;
  save(draft: BrandingDraft, tx?: TransactionContext): Promise<BrandingView>;
}

export const BRANDING = Symbol('BRANDING');
