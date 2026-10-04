export interface BrandColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export function applyBrandTheme(
  root: HTMLElement,
  branding: BrandColors,
): void {
  root.style.setProperty('--brand-primary', branding.primaryColor);
  root.style.setProperty('--brand-secondary', branding.secondaryColor);
  root.style.setProperty('--brand-accent', branding.accentColor);
}

export function clearBrandTheme(root: HTMLElement): void {
  root.style.removeProperty('--brand-primary');
  root.style.removeProperty('--brand-secondary');
  root.style.removeProperty('--brand-accent');
}
