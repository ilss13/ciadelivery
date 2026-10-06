import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequirePermissions } from '@ciadelivery/users';
import {
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ChangeOnboarding,
  OnboardingActor,
} from '../application/onboarding';
import { OnboardingChecklistResponse } from './onboarding.dto';

@ApiTags('admin-onboarding')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/store')
export class AdminPublicationController {
  constructor(private readonly change: ChangeOnboarding) {}

  @Post('publish')
  @HttpCode(200)
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  publish(
    @Req() request: { actor?: OnboardingActor },
  ): Promise<OnboardingChecklistResponse> {
    return this.change.publish(actorFrom(request));
  }

  @Post('unpublish')
  @HttpCode(200)
  @ApiOkResponse({ type: OnboardingChecklistResponse })
  unpublish(
    @Req() request: { actor?: OnboardingActor },
  ): Promise<OnboardingChecklistResponse> {
    return this.change.unpublish(actorFrom(request));
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
