import { DomainException } from '@ciadelivery/shared';
import { TenantContextInterceptor } from '@ciadelivery/tenancy/guards';
import {
  PermissionsGuard,
  RequestActor,
  RequirePermissions,
} from '@ciadelivery/users';
import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AdminReports } from '../application/admin-reports';
import {
  CourierReportResponse,
  CustomerReportResponse,
  ProductReportResponse,
  ReportOverviewResponse,
  ReportPeriodQuery,
} from './reports.dto';

@ApiTags('admin-reports')
@ApiBearerAuth('bearer')
@UseGuards(PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
@RequirePermissions('reports.read')
@Controller('api/v1/admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: AdminReports) {}

  @Get('overview')
  @ApiOkResponse({ type: ReportOverviewResponse })
  overview(
    @Req() request: { actor?: RequestActor },
    @Query() query: ReportPeriodQuery,
  ): Promise<ReportOverviewResponse> {
    return this.reports.overview(actorFrom(request), query);
  }

  @Get('products')
  @ApiOkResponse({ type: [ProductReportResponse] })
  products(
    @Req() request: { actor?: RequestActor },
    @Query() query: ReportPeriodQuery,
  ): Promise<ProductReportResponse[]> {
    return this.reports.products(actorFrom(request), query);
  }

  @Get('customers')
  @ApiOkResponse({ type: [CustomerReportResponse] })
  customers(
    @Req() request: { actor?: RequestActor },
    @Query() query: ReportPeriodQuery,
  ): Promise<CustomerReportResponse[]> {
    return this.reports.customers(actorFrom(request), query);
  }

  @Get('couriers')
  @ApiOkResponse({ type: [CourierReportResponse] })
  couriers(
    @Req() request: { actor?: RequestActor },
    @Query() query: ReportPeriodQuery,
  ): Promise<CourierReportResponse[]> {
    return this.reports.couriers(actorFrom(request), query);
  }

  @Get('orders.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="pedidos.csv"')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    schema: { type: 'string', description: 'CSV attachment of the period orders' },
  })
  ordersCsv(
    @Req() request: { actor?: RequestActor },
    @Query() query: ReportPeriodQuery,
  ): Promise<string> {
    return this.reports.exportOrders(actorFrom(request), query);
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
