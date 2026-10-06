import { PilotStatusReader, PilotTenantStatus } from '../domain/pilot-status';

const PILOT_WINDOW_DAYS = 7;

export interface PilotStatusView {
  generatedAt: string;
  windowDays: number;
  tenants: PilotTenantStatus[];
}

export class ReadPilotStatus {
  constructor(
    private readonly statuses: PilotStatusReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<PilotStatusView> {
    const generatedAt = this.now();
    const since = new Date(generatedAt);
    since.setUTCDate(since.getUTCDate() - PILOT_WINDOW_DAYS);
    return {
      generatedAt: generatedAt.toISOString(),
      windowDays: PILOT_WINDOW_DAYS,
      tenants: await this.statuses.list(since),
    };
  }
}
