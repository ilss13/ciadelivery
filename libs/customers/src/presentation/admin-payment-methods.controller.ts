import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import { PaymentMethods } from '../application/payment-methods';
import {
  PaymentMethodListResponse,
  ReplacePaymentMethodsDto,
} from './customer.dto';
import { actorFrom } from './http';

@ApiTags('admin-payment-methods')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/payment-methods')
export class AdminPaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethods) {}

  @Get()
  @ApiOkResponse({ type: PaymentMethodListResponse })
  list(
    @Req() request: { actor?: RequestActor },
  ): Promise<PaymentMethodListResponse> {
    return this.paymentMethods
      .list(actorFrom(request))
      .then((methods) => ({ methods }));
  }

  @Put()
  @ApiOkResponse({ type: PaymentMethodListResponse })
  replace(
    @Req() request: { actor?: RequestActor },
    @Body() body: ReplacePaymentMethodsDto,
  ): Promise<PaymentMethodListResponse> {
    return this.paymentMethods
      .replace(
        actorFrom(request),
        body.methods.map((method) => ({
          code: method.code,
          label: method.label,
          instructions: method.instructions ?? null,
          enabled: method.enabled,
        })),
      )
      .then((methods) => ({ methods }));
  }
}
