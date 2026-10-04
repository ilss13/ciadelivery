import { DomainException } from '@ciadelivery/shared';
import { normalizeColor } from './color';

export interface BrandingView {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  seoTitle: string;
  seoDescription: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
}

export type BrandingDraft = BrandingView;

export function defaultBranding(storeName: string): BrandingView {
  return {
    displayName: storeName,
    logoUrl: null,
    faviconUrl: null,
    bannerUrl: null,
    primaryColor: '#111827',
    secondaryColor: '#FFFFFF',
    accentColor: '#374151',
    fontFamily: null,
    seoTitle: storeName,
    seoDescription: '',
    instagramUrl: null,
    facebookUrl: null,
    websiteUrl: null,
    contactEmail: null,
    whatsappPhone: null,
  };
}

export function normalizeBranding(draft: BrandingDraft): BrandingView {
  return {
    displayName: requiredText(draft.displayName, 160),
    logoUrl: optionalText(draft.logoUrl, 500),
    faviconUrl: optionalText(draft.faviconUrl, 500),
    bannerUrl: optionalText(draft.bannerUrl, 500),
    primaryColor: normalizeColor(draft.primaryColor),
    secondaryColor: normalizeColor(draft.secondaryColor),
    accentColor: normalizeColor(draft.accentColor),
    fontFamily: optionalText(draft.fontFamily, 80),
    seoTitle: boundedText(draft.seoTitle, 180),
    seoDescription: boundedText(draft.seoDescription, 320),
    instagramUrl: optionalText(draft.instagramUrl, 500),
    facebookUrl: optionalText(draft.facebookUrl, 500),
    websiteUrl: optionalText(draft.websiteUrl, 500),
    contactEmail: optionalEmail(draft.contactEmail),
    whatsappPhone: optionalText(draft.whatsappPhone, 20),
  };
}

function requiredText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    throw invalidPayload();
  }

  return trimmed;
}

function boundedText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw invalidPayload();
  }

  return trimmed;
}

function optionalText(value: string | null, max: number): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > max) {
    throw invalidPayload();
  }

  return trimmed;
}

function optionalEmail(value: string | null): string | null {
  const email = optionalText(value, 255);
  if (email === null) {
    return null;
  }

  const normalized = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw invalidPayload();
  }

  return normalized;
}

function invalidPayload(): DomainException {
  return new DomainException(
    'VALIDATION_ERROR',
    'The request payload is invalid',
    400,
  );
}
