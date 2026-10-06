import { memoryFileStorage } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import { PermissionsGuard, RequestActor, RequirePermissions } from '@ciadelivery/users';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
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
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ImportCatalog } from '../application/import-catalog';
import { CatalogImportSummaryResponse } from './catalog.dto';
import { actorFrom } from './http';

@ApiTags('admin-catalog')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('catalog.manage')
@Controller('api/v1/admin/catalog')
export class AdminCatalogImportController {
  constructor(private readonly importCatalog: ImportCatalog) {}

  @Get('import-template')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="modelo-cardapio.csv"')
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string' } })
  template(): string {
    return CATALOG_IMPORT_TEMPLATE;
  }

  @Post('import')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: CatalogImportSummaryResponse })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryFileStorage(),
      limits: { fileSize: 1024 * 1024, files: 1 },
    }),
  )
  import(
    @Req() request: { actor?: RequestActor },
    @UploadedFile() file: UploadedCsv | undefined,
  ): Promise<CatalogImportSummaryResponse> {
    return this.importCatalog.execute(
      actorFrom(request),
      file === undefined
        ? undefined
        : {
            buffer: file.buffer,
            mimeType: file.mimetype,
            originalName: file.originalname,
            size: file.size,
          },
    );
  }
}

interface UploadedCsv {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const CATALOG_IMPORT_TEMPLATE = [
  'category,product,description,price,sku,option_group,option_name,option_price,option_min,option_max',
  'Pizzas,Calabresa,Pizza de calabresa,"49,90",PIZ-CAL,Tamanho,Média,"0,00",1,1',
  'Pizzas,Calabresa,Pizza de calabresa,"49,90",PIZ-CAL,Tamanho,Grande,"10,00",1,1',
  'Pizzas,Calabresa,Pizza de calabresa,"49,90",PIZ-CAL,Adicionais,Borda recheada,"8,00",0,2',
].join('\n');
