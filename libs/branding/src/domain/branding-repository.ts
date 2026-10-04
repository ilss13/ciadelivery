import { BrandingDraft, BrandingView } from './branding';

export interface BrandingRepository {
  findCurrent(): Promise<BrandingView | null>;
  save(draft: BrandingDraft): Promise<BrandingView>;
}

export const BRANDING = Symbol('BRANDING');
