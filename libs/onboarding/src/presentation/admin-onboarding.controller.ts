import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard } from '@ciadelivery/users';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ChangeOnboarding,
  OnboardingActor,
  ReadOnboarding,
} from '../application/onboarding';
import {
  OnboardingChecklistResponse,
  OnboardingCodeParam,
  OnboardingNoteDto,
} from './onboarding.dto';

@ApiTags('admin-onboarding')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/admin/onboarding')
export class AdminOnboardingController {
  constructor(
    private readonly read: ReadOnboarding,
    private readonly change: ChangeOnboarding,
  ) {}

  @Get()
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  get(
    @Req() request: { actor?: OnboardingActor },
  ): Promise<OnboardingChecklistResponse> {
    return this.read.forActor(actorFrom(request));
  }

  @Post(':code/complete')
  @HttpCode(200)
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  complete(
    @Req() request: { actor?: OnboardingActor },
    @Param() params: OnboardingCodeParam,
    @Body() body: OnboardingNoteDto,
  ): Promise<OnboardingChecklistResponse> {
    return this.change.complete(actorFrom(request), params.code, noteOf(body));
  }

  @Post(':code/skip')
  @HttpCode(200)
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  skip(
    @Req() request: { actor?: OnboardingActor },
    @Param() params: OnboardingCodeParam,
    @Body() body: OnboardingNoteDto,
  ): Promise<OnboardingChecklistResponse> {
    return this.change.skip(actorFrom(request), params.code, noteOf(body));
  }
}

function actorFrom(request: { actor?: OnboardingActor }): OnboardingActor {
  if (request.actor === undefined) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }
  return request.actor;
}

function noteOf(body: OnboardingNoteDto): string | null {
  if (body.note === undefined || body.note === null) {
    return null;
  }
  const note = body.note.trim();
  return note.length === 0 ? null : note;
}
