import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { CreateLead } from '../application/create-lead';
import { CreateLeadDto, LeadCreatedResponse } from './create-lead.dto';

interface LeadRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
}

@ApiTags('public-leads')
@Controller('api/v1/public/leads')
export class PublicLeadsController {
  constructor(private readonly createLead: CreateLead) {}

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: LeadCreatedResponse })
  create(
    @Body() body: CreateLeadDto,
    @Req() request: LeadRequest,
  ): Promise<LeadCreatedResponse> {
    return this.createLead.execute(
      {
        name: body.name,
        email: body.email,
        phone: body.phone,
        establishmentName: body.establishmentName,
      },
      clientIp(request),
    );
  }
}

function clientIp(request: LeadRequest): string {
  const address = request.ip ?? request.socket?.remoteAddress ?? '';
  return address.length > 0 ? address : 'unknown';
}
