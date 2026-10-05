import {
  Controller,
  HttpCode,
  Post,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainException } from '@ciadelivery/shared';
import type { Request, Response } from 'express';
import {
  ReceiveWhatsAppWebhook,
  VerifyWhatsAppWebhook,
} from '../application/receive-webhook';

@ApiTags('webhooks')
@Controller('api/v1/webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly verify: VerifyWhatsAppWebhook,
    private readonly receive: ReceiveWhatsAppWebhook,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Verify the Meta webhook subscription',
  })
  @ApiOkResponse({ schema: { type: 'string' } })
  verifySubscription(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): string {
    const mode = hubParam(request.query, 'mode');
    const token = hubParam(request.query, 'verify_token');
    const challenge = hubParam(request.query, 'challenge');
    if (
      mode !== 'subscribe' ||
      challenge === undefined ||
      !this.verify.matches(token)
    ) {
      throw new DomainException(
        'WHATSAPP_WEBHOOK_FORBIDDEN',
        'The webhook verification failed',
        403,
      );
    }

    response.type('text/plain; charset=utf-8');
    return challenge;
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Receive a signed Meta webhook',
    description:
      'Validates X-Hub-Signature-256 against the raw body and stores the event for the connected phone number.',
  })
  async receiveEvent(@Req() request: Request): Promise<void> {
    if (!Buffer.isBuffer(request.body)) {
      throw new DomainException(
        'WHATSAPP_SIGNATURE_INVALID',
        'The webhook signature is invalid',
        401,
      );
    }

    const signature = request.header('x-hub-signature-256');
    await this.receive.execute(request.body, signature);
  }
}

function hubParam(
  query: Request['query'],
  key: 'mode' | 'verify_token' | 'challenge',
): string | undefined {
  const direct = query[`hub.${key}`];
  const nested = query['hub'];
  const value =
    direct ??
    (isRecord(nested) ? nested[key] : undefined);
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
    return value[0];
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
