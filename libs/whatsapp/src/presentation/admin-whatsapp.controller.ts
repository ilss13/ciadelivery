import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import { AdminConversations } from '../application/admin-conversations';
import { AdminWhatsApp } from '../application/admin-whatsapp';
import {
  ConnectWhatsAppDto,
  ConversationIdParam,
  ConversationListItemResponse,
  ConversationListResponse,
  ConversationMessageResponse,
  ConversationPageQuery,
  ConversationThreadResponse,
  SendConversationMessageDto,
  UpdateWhatsAppTemplateDto,
  WhatsAppConnectionResponse,
  WhatsAppSendListResponse,
  WhatsAppTemplateListResponse,
  WhatsAppTemplateResponse,
} from './whatsapp.dto';

@ApiTags('admin-whatsapp')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('whatsapp.operate')
@Controller('api/v1/admin/whatsapp')
export class AdminWhatsAppController {
  constructor(
    private readonly whatsapp: AdminWhatsApp,
    private readonly conversations: AdminConversations,
  ) {}

  @Get('connection')
  @ApiOperation({
    summary: 'Read the store WhatsApp connection',
    description:
      'Returns the official Cloud API connection. The access token is never included.',
  })
  @ApiOkResponse({ type: WhatsAppConnectionResponse })
  getConnection(
    @Req() request: { actor?: RequestActor },
  ): Promise<WhatsAppConnectionResponse> {
    return this.whatsapp.getConnection(actorFrom(request));
  }

  @Post('connect')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Connect the store WhatsApp number',
    description:
      'Stores the establishment access token encrypted. Replacing a connection disconnects the previous secret.',
  })
  @ApiOkResponse({ type: WhatsAppConnectionResponse })
  connect(
    @Req() request: { actor?: RequestActor },
    @Body() body: ConnectWhatsAppDto,
  ): Promise<WhatsAppConnectionResponse> {
    return this.whatsapp.connect(actorFrom(request), {
      phoneNumber: body.phoneNumber,
      businessAccountId: body.businessAccountId,
      phoneNumberId: body.phoneNumberId,
      accessToken: body.accessToken,
    });
  }

  @Get('sends')
  @ApiOperation({
    summary: 'List recent system WhatsApp sends',
    description:
      'The last 50 system messages for this store: template, status, time and a short error. Bodies and tokens are omitted.',
  })
  @ApiOkResponse({ type: WhatsAppSendListResponse })
  listSends(
    @Req() request: { actor?: RequestActor },
  ): Promise<WhatsAppSendListResponse> {
    return this.whatsapp.listSends(actorFrom(request));
  }

  @Get('templates')
  @ApiOperation({
    summary: 'List order status WhatsApp templates',
    description:
      'The eight status templates. The owner can disable a key. The last send error shows a masked phone.',
  })
  @ApiOkResponse({ type: WhatsAppTemplateListResponse })
  async listTemplates(
    @Req() request: { actor?: RequestActor },
  ): Promise<WhatsAppTemplateListResponse> {
    const data = await this.whatsapp.listTemplates(actorFrom(request));
    return { data };
  }

  @Patch('templates/:key')
  @ApiOperation({ summary: 'Enable or disable an order status template' })
  @ApiOkResponse({ type: WhatsAppTemplateResponse })
  setTemplate(
    @Req() request: { actor?: RequestActor },
    @Param('key') key: string,
    @Body() body: UpdateWhatsAppTemplateDto,
  ): Promise<WhatsAppTemplateResponse> {
    return this.whatsapp.setTemplateEnabled(actorFrom(request), key, body.enabled);
  }

  @Delete('connection')
  @HttpCode(204)
  @ApiNoContentResponse()
  disconnect(@Req() request: { actor?: RequestActor }): Promise<void> {
    return this.whatsapp.disconnect(actorFrom(request));
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List WhatsApp conversations',
    description:
      'Newest activity first. The phone on the card is masked. The full number is only on the thread.',
  })
  @ApiOkResponse({ type: ConversationListResponse })
  listConversations(
    @Req() request: { actor?: RequestActor },
    @Query() query: ConversationPageQuery,
  ): Promise<ConversationListResponse> {
    return this.conversations.list(
      actorFrom(request),
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Read a WhatsApp conversation thread' })
  @ApiOkResponse({ type: ConversationThreadResponse })
  listMessages(
    @Req() request: { actor?: RequestActor },
    @Param() param: ConversationIdParam,
    @Query() query: ConversationPageQuery,
  ): Promise<ConversationThreadResponse> {
    return this.conversations.listMessages(
      actorFrom(request),
      param.id,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Post('conversations/:id/messages')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Reply in a WhatsApp conversation',
    description: 'Queues a session text on the store number.',
  })
  @ApiCreatedResponse({ type: ConversationMessageResponse })
  reply(
    @Req() request: { actor?: RequestActor },
    @Param() param: ConversationIdParam,
    @Body() body: SendConversationMessageDto,
  ): Promise<ConversationMessageResponse> {
    return this.conversations.reply(actorFrom(request), param.id, body.body);
  }

  @Post('conversations/:id/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close a WhatsApp conversation' })
  @ApiOkResponse({ type: ConversationListItemResponse })
  closeConversation(
    @Req() request: { actor?: RequestActor },
    @Param() param: ConversationIdParam,
  ): Promise<ConversationListItemResponse> {
    return this.conversations.close(actorFrom(request), param.id);
  }
}

function actorFrom(request: { actor?: RequestActor }): RequestActor {
  if (request.actor === undefined) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }
  return request.actor;
}
