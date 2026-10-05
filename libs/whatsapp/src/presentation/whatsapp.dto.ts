import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ConnectWhatsAppDto {
  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  phoneNumber!: string;

  @ApiProperty({ example: '102290129340398' })
  @IsString()
  @Matches(/^\d{1,64}$/)
  businessAccountId!: string;

  @ApiProperty({ example: '106540352242922' })
  @IsString()
  @Matches(/^\d{1,64}$/)
  phoneNumberId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  accessToken!: string;
}

export class WhatsAppConnectionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['META_CLOUD'] })
  provider!: 'META_CLOUD';

  @ApiProperty()
  phoneNumber!: string;

  @ApiProperty()
  businessAccountId!: string;

  @ApiProperty()
  phoneNumberId!: string;

  @ApiProperty({
    enum: ['PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR'],
  })
  status!: 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Last four characters of the token',
  })
  credentialsHint!: string | null;

  @ApiProperty({ type: String, nullable: true })
  connectedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  disconnectedAt!: string | null;
}

export class UpdateWhatsAppTemplateDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class WhatsAppTemplateErrorResponse {
  @ApiProperty({ example: '*******1234' })
  maskedPhone!: string;

  @ApiProperty({ example: 'TEMPLATE_NOT_APPROVED' })
  message!: string;
}

export class WhatsAppTemplateResponse {
  @ApiProperty({
    enum: [
      'order_received',
      'order_accepted',
      'order_rejected',
      'order_preparing',
      'order_ready',
      'order_out_for_delivery',
      'order_delivered',
      'order_cancelled',
    ],
  })
  key!: string;

  @ApiProperty({ example: 'pt_BR' })
  language!: string;

  @ApiProperty()
  metaTemplateName!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  persisted!: boolean;

  @ApiProperty({ type: WhatsAppTemplateErrorResponse, nullable: true })
  lastError!: WhatsAppTemplateErrorResponse | null;
}

export class WhatsAppSendResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true, example: 'order_received' })
  templateKey!: string | null;

  @ApiProperty({ enum: ['QUEUED', 'SENT', 'FAILED', 'SKIPPED'] })
  status!: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;
}

export class WhatsAppSendListResponse {
  @ApiProperty({ type: [WhatsAppSendResponse] })
  data!: WhatsAppSendResponse[];
}

export class WhatsAppTemplateListResponse {
  @ApiProperty({ type: [WhatsAppTemplateResponse] })
  data!: WhatsAppTemplateResponse[];
}

export class ConversationPageQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ConversationIdParam {
  @IsUUID('4')
  id!: string;
}

export class SendConversationMessageDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}

export class ConversationListItemResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '*********1234' })
  maskedPhone!: string;

  @ApiProperty({ type: String, nullable: true })
  contactName!: string | null;

  @ApiProperty({ enum: ['BOT', 'HUMAN', 'PAUSED', 'CLOSED'] })
  mode!: 'BOT' | 'HUMAN' | 'PAUSED' | 'CLOSED';

  @ApiProperty({ type: String, nullable: true })
  linkedOrderId!: string | null;

  @ApiProperty()
  lastMessageAt!: string;
}

export class PageMetaResponse {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ConversationListResponse {
  @ApiProperty({ type: [ConversationListItemResponse] })
  data!: ConversationListItemResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}

export class ConversationMessageResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['IN', 'OUT'] })
  direction!: 'IN' | 'OUT';

  @ApiProperty({ enum: ['CUSTOMER', 'USER', 'SYSTEM'] })
  author!: 'CUSTOMER' | 'USER' | 'SYSTEM';

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: String, nullable: true })
  templateKey!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ConversationDetailResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  contactPhone!: string;

  @ApiProperty({ type: String, nullable: true })
  contactName!: string | null;

  @ApiProperty({ enum: ['BOT', 'HUMAN', 'PAUSED', 'CLOSED'] })
  mode!: 'BOT' | 'HUMAN' | 'PAUSED' | 'CLOSED';

  @ApiProperty({ type: String, nullable: true })
  linkedOrderId!: string | null;

  @ApiProperty()
  lastMessageAt!: string;
}

export class ConversationThreadResponse {
  @ApiProperty({ type: ConversationDetailResponse })
  conversation!: ConversationDetailResponse;

  @ApiProperty({ type: [ConversationMessageResponse] })
  data!: ConversationMessageResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}
