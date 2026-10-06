import { OnboardingCode } from './steps';

export interface PilotTenantStatus {
  tenantId: string;
  name: string;
  slug: string;
  published: boolean;
  pendingSteps: OnboardingCode[];
  storefrontOrdersLast7Days: number;
  failedWhatsAppMessages: number;
}

export interface PilotStatusReader {
  list(since: Date): Promise<PilotTenantStatus[]>;
}

export const PILOT_STATUS = Symbol('PILOT_STATUS');
