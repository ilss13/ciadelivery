import { Module } from '@nestjs/common';
import {
  TenancyCoreModule,
  UNIT_OF_WORK,
  UnitOfWork,
} from '@ciadelivery/tenancy';
import { PermissionsGuard } from '@ciadelivery/users';
import { ChangeOnboarding, ReadOnboarding } from './application/onboarding';
import { ReadPilotStatus } from './application/read-pilot-status';
import { CHECKLIST, Checklist } from './domain/checklist';
import { PILOT_STATUS, PilotStatusReader } from './domain/pilot-status';
import { TypeOrmChecklist } from './infrastructure/typeorm-checklist';
import { TypeOrmPilotStatus } from './infrastructure/typeorm-pilot-status';
import { AdminOnboardingController } from './presentation/admin-onboarding.controller';
import { AdminPublicationController } from './presentation/admin-publication.controller';
import { PlatformOnboardingController } from './presentation/platform-onboarding.controller';
import { PlatformPilotStatusController } from './presentation/platform-pilot-status.controller';

@Module({
  imports: [TenancyCoreModule],
  controllers: [
    AdminOnboardingController,
    AdminPublicationController,
    PlatformOnboardingController,
    PlatformPilotStatusController,
  ],
  providers: [
    PermissionsGuard,
    TypeOrmChecklist,
    { provide: CHECKLIST, useExisting: TypeOrmChecklist },
    TypeOrmPilotStatus,
    { provide: PILOT_STATUS, useExisting: TypeOrmPilotStatus },
    {
      provide: ReadOnboarding,
      useFactory: (checklist: Checklist) => new ReadOnboarding(checklist),
      inject: [CHECKLIST],
    },
    {
      provide: ChangeOnboarding,
      useFactory: (
        checklist: Checklist,
        unitOfWork: UnitOfWork,
        read: ReadOnboarding,
      ) => new ChangeOnboarding(checklist, unitOfWork, read),
      inject: [CHECKLIST, UNIT_OF_WORK, ReadOnboarding],
    },
    {
      provide: ReadPilotStatus,
      useFactory: (statuses: PilotStatusReader) =>
        new ReadPilotStatus(statuses),
      inject: [PILOT_STATUS],
    },
  ],
  exports: [CHECKLIST],
})
export class OnboardingModule {}
