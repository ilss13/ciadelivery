import { DomainException, FileInput, memoryFileStorage } from '@ciadelivery/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import {
  GetBranding,
  SaveBranding,
  UploadBrandingImage,
} from '../application/branding-settings';
import { BrandingView } from '../domain/branding';
import { BrandingDto } from './branding.dto';
import { StoredFileDto } from './stored-file.dto';

const imageInterceptor = FileInterceptor('file', {
  storage: memoryFileStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

@ApiTags('admin-branding')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('store.configure')
@Controller('api/v1/admin/branding')
export class AdminBrandingController {
  constructor(
    private readonly getBranding: GetBranding,
    private readonly saveBranding: SaveBranding,
    private readonly uploadImage: UploadBrandingImage,
  ) {}

  @Get()
  @ApiOkResponse({ type: BrandingDto })
  get(@Req() request: { actor?: RequestActor }): Promise<BrandingView> {
    return this.getBranding.execute(actorFrom(request));
  }

  @Put()
  @ApiOkResponse({ type: BrandingDto })
  update(
    @Req() request: { actor?: RequestActor },
    @Body() body: BrandingDto,
  ): Promise<BrandingView> {
    return this.saveBranding.execute(actorFrom(request), body);
  }

  @Post('logo')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: StoredFileDto })
  @UseInterceptors(imageInterceptor)
  uploadLogo(
    @Req() request: { actor?: RequestActor },
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<StoredFileDto> {
    return this.uploadImage.execute(actorFrom(request), 'logos', imageFile(file, 'logos'));
  }

  @Post('favicon')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: StoredFileDto })
  @UseInterceptors(imageInterceptor)
  uploadFavicon(
    @Req() request: { actor?: RequestActor },
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<StoredFileDto> {
    return this.uploadImage.execute(
      actorFrom(request),
      'favicons',
      imageFile(file, 'favicons'),
    );
  }

  @Post('banner')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: StoredFileDto })
  @UseInterceptors(imageInterceptor)
  uploadBanner(
    @Req() request: { actor?: RequestActor },
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<StoredFileDto> {
    return this.uploadImage.execute(
      actorFrom(request),
      'banners',
      imageFile(file, 'banners'),
    );
  }
}

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

function imageFile(
  file: UploadedImage | undefined,
  kind: 'logos' | 'favicons' | 'banners',
): FileInput {
  if (file === undefined || !Buffer.isBuffer(file.buffer)) {
    throw new DomainException(
      'INVALID_FILE',
      'The file is not an accepted image',
      400,
    );
  }

  return {
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
    originalName: file.originalname,
    tenantId: '00000000-0000-4000-8000-000000000000',
    kind,
  };
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
