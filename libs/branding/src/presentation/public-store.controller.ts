import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import {
  GetPublicStore,
  PublicStoreProfile,
} from '../application/get-public-store';
import { PublicStoreResponse } from './public-store.dto';

@ApiTags('public-store')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@Controller('api/v1/public/store')
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class PublicStoreController {
  constructor(private readonly getPublicStore: GetPublicStore) {}

  @Get()
  @ApiOkResponse({ type: PublicStoreResponse })
  getStore(): Promise<PublicStoreProfile> {
    return this.getPublicStore.execute();
  }
}
