import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ONBOARDING_CODES } from '../domain/steps';

export class OnboardingNoteDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class OnboardingCodeParam {
  @IsIn([...ONBOARDING_CODES])
  code!: string;
}

export class TenantOnboardingParam {
  @IsUUID('4')
  id!: string;
}

export class OnboardingStepResponse {
  @ApiProperty({ enum: ONBOARDING_CODES })
  code!: string;

  @ApiProperty({ enum: ['PENDING', 'DONE', 'SKIPPED'] })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  doneAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  doneBy!: string | null;

  @ApiProperty({ nullable: true, type: String })
  note!: string | null;
}

export class OnboardingChecklistResponse {
  @ApiProperty()
  published!: boolean;

  @ApiProperty({ type: OnboardingStepResponse, isArray: true })
  steps!: OnboardingStepResponse[];

  @ApiProperty({ nullable: true, enum: ONBOARDING_CODES })
  nextCode!: string | null;

  @ApiProperty({ enum: ONBOARDING_CODES, isArray: true })
  blockingCodes!: string[];
}

export class PilotTenantStatusResponse {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  published!: boolean;

  @ApiProperty({ enum: ONBOARDING_CODES, isArray: true })
  pendingSteps!: string[];

  @ApiProperty()
  storefrontOrdersLast7Days!: number;

  @ApiProperty()
  failedWhatsAppMessages!: number;
}

export class PilotStatusResponse {
  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ example: 7 })
  windowDays!: number;

  @ApiProperty({ type: PilotTenantStatusResponse, isArray: true })
  tenants!: PilotTenantStatusResponse[];
}
