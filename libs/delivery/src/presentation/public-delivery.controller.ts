import { Body, Controller, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { QuotePublicDelivery } from '../application/quote-public-delivery';
import {
  PublicDeliveryQuoteDto,
  PublicDeliveryQuoteResponse,
} from './delivery.dto';

@ApiTags('public-delivery')
@ApiHeader({
  name: 'X-Tenant-Host',
  required: false,
  description:
    'Replaces the Host header only when NODE_ENV is local or development',
})
@UseGuards(PublicTenantGuard)
@UseInterceptors(TenantContextInterceptor)
@Controller('api/v1/public/delivery')
export class PublicDeliveryController {
  constructor(private readonly quote: QuotePublicDelivery) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOkResponse({ type: PublicDeliveryQuoteResponse })
  quoteDelivery(
    @Body() body: PublicDeliveryQuoteDto,
  ): Promise<PublicDeliveryQuoteResponse> {
    return this.quote.execute({
      fulfillment: body.fulfillment ?? null,
      address:
        body.address === undefined
          ? null
          : {
              line: body.address.line,
              number: body.address.number,
              district: body.address.district,
              city: body.address.city,
              state: body.address.state,
              postalCode: body.address.postalCode,
              complement: body.address.complement ?? null,
            },
    });
  }
}
