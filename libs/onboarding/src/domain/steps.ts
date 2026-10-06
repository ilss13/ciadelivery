export const ONBOARDING_CODES = [
  'create_tenant',
  'create_store',
  'configure_branding',
  'configure_domain',
  'configure_address',
  'configure_hours',
  'configure_delivery',
  'create_owner',
  'import_catalog',
  'connect_whatsapp',
  'create_couriers',
  'place_test_order',
  'validate_notifications',
  'train_team',
  'publish_store',
] as const;

export type OnboardingCode = (typeof ONBOARDING_CODES)[number];

export const ONBOARDING_STATUSES = ['PENDING', 'DONE', 'SKIPPED'] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const MANUAL_COMPLETE_CODES = [
  'validate_notifications',
  'train_team',
] as const satisfies readonly OnboardingCode[];

export const LOCKED_STEP_CODES = [
  'create_tenant',
  'create_store',
  'publish_store',
] as const satisfies readonly OnboardingCode[];

const PUBLISH_GATES = [
  'configure_branding',
  'configure_address',
  'configure_hours',
] as const satisfies readonly OnboardingCode[];

export function isOnboardingCode(value: string): value is OnboardingCode {
  return (ONBOARDING_CODES as readonly string[]).includes(value);
}

export function blockingPublishCodes(
  steps: readonly { code: string; status: string }[],
  activeProductCount: number,
): OnboardingCode[] {
  const status = new Map(steps.map((step) => [step.code, step.status]));
  const missing: OnboardingCode[] = [];
  for (const code of PUBLISH_GATES) {
    if (status.get(code) !== 'DONE') {
      missing.push(code);
    }
  }
  if (activeProductCount < 1) {
    missing.push('import_catalog');
  }
  return missing;
}

export function nextPendingCode(
  steps: readonly { code: string; status: string }[],
): OnboardingCode | null {
  for (const code of ONBOARDING_CODES) {
    const status = steps.find((step) => step.code === code)?.status;
    if (status === 'PENDING') {
      return code;
    }
  }
  return null;
}
