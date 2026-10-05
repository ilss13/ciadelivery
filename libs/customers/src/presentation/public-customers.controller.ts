import { Body, Controller, HttpCode, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { IdentifyCustomer } from '../application/identify-customer';
import {
  IdentifiedCustomerResponse,
  IdentifyCustomerDto,
} from './customer.dto';
import { clientIp } from './http';

@ApiTags('public-customers')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/customers')
export class PublicCustomersController {
  constructor(private readonly identifyCustomer: IdentifyCustomer) {}

  @Post('identify')
  @HttpCode(200)
  @ApiOkResponse({ type: IdentifiedCustomerResponse })
  identify(
    @Body() body: IdentifyCustomerDto,
    @Req() request: { ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<IdentifiedCustomerResponse> {
    return this.identifyCustomer.execute(
      { name: body.name, phone: body.phone },
      clientIp(request),
    );
  }
}
