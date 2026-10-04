import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { ValidatePublicCart } from '../application/validate-cart';
import { CartValidation } from '../domain/cart';
import { CartValidationResponse, ValidateCartDto } from './catalog.dto';

@ApiTags('public-catalog')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/cart')
export class PublicCartController {
  constructor(private readonly carts: ValidatePublicCart) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOkResponse({ type: CartValidationResponse })
  validate(@Body() body: ValidateCartDto): Promise<CartValidation> {
    return this.carts.execute(
      body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        optionIds: item.optionIds,
        notes: item.notes ?? null,
      })),
    );
  }
}
