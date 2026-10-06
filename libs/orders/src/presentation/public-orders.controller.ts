import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  PublicTenantGuard,
  TenantContextInterceptor,
} from '@ciadelivery/tenancy/guards';
import { CreatePublicOrder } from '../application/create-public-order';
import { GetPublicOrder } from '../application/get-public-order';
import { ReviewPublicOrder } from '../application/review-public-order';
import {
  CreateOrderDto,
  CreatedOrderResponse,
  OrderReviewResponse,
  PublicOrderResponse,
  ReviewOrderDto,
} from './order.dto';
import { clientIp, headerValue } from './http';

@ApiTags('public-orders')
@Controller('api/v1/public/orders')
export class PublicOrdersController {
  constructor(
    private readonly createOrder: CreatePublicOrder,
    private readonly reviewOrder: ReviewPublicOrder,
    private readonly getOrder: GetPublicOrder,
  ) {}

  @Post('review')
  @HttpCode(200)
  @ApiHeader({
    name: 'X-Tenant-Host',
    required: false,
    description:
      'Replaces the Host header only when NODE_ENV is local or development',
  })
  @ApiOkResponse({ type: OrderReviewResponse })
  @UseGuards(PublicTenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  review(
    @Body() body: ReviewOrderDto,
    @Req() request: { ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<OrderReviewResponse> {
    return this.reviewOrder.execute(
      {
        fulfillment: body.fulfillment,
        address:
          body.address === undefined || body.address === null
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
        paymentMethodCode: body.paymentMethodCode,
        items: body.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionIds: item.optionIds,
          notes: item.notes ?? null,
        })),
      },
      clientIp(request),
    );
  }

  @Post()
  @HttpCode(201)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({
    name: 'X-Tenant-Host',
    required: false,
    description:
      'Replaces the Host header only when NODE_ENV is local or development',
  })
  @ApiCreatedResponse({ type: CreatedOrderResponse })
  @UseGuards(PublicTenantGuard)
  @UseInterceptors(TenantContextInterceptor)
  create(
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | string[] | undefined,
    @Headers('user-agent') userAgent: string | string[] | undefined,
    @Req() request: { ip?: string; socket?: { remoteAddress?: string } },
  ): Promise<CreatedOrderResponse> {
    return this.createOrder.execute(
      {
        customer: { name: body.customer.name, phone: body.customer.phone },
        fulfillment: body.fulfillment,
        address:
          body.address === undefined || body.address === null
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
        paymentMethodCode: body.paymentMethodCode,
        notes: body.notes ?? null,
        consents: {
          operational: body.consents.operational,
          marketing: body.consents.marketing,
          policyVersion: body.consents.policyVersion,
        },
        items: body.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          optionIds: item.optionIds,
          notes: item.notes ?? null,
        })),
      },
      {
        idempotencyKey: headerValue(idempotencyKey),
        ip: clientIp(request),
        userAgent: headerValue(userAgent),
      },
    );
  }

  @Get(':trackingToken')
  @ApiOkResponse({ type: PublicOrderResponse })
  get(@Param('trackingToken') trackingToken: string): Promise<PublicOrderResponse> {
    return this.getOrder.execute(trackingToken);
  }
}
