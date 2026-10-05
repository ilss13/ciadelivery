import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { GetPublicCheckout } from '../application/get-public-checkout';
import { PublicCheckoutResponse } from './order.dto';

@ApiTags('public-checkout')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/checkout')
export class PublicCheckoutController {
  constructor(private readonly checkout: GetPublicCheckout) {}

  @Get()
  @ApiOkResponse({ type: PublicCheckoutResponse })
  get(): Promise<PublicCheckoutResponse> {
    return this.checkout.execute();
  }
}
