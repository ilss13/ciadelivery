import { Controller, Get, Header, Inject, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { APP_CONFIG, AppConfig } from '../app-config';
import { MetricsService } from './metrics.service';
import { metricsAuthorized } from './prometheus';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Prometheus metrics',
    description:
      'Open when METRICS_TOKEN is unset. When set, requires Authorization: Bearer <METRICS_TOKEN>.',
  })
  async scrape(
    @Req() request: { headers: Record<string, string | string[] | undefined> },
    @Res() response: Response,
  ): Promise<void> {
    const authorization = readHeader(request.headers['authorization']);
    if (!metricsAuthorized(authorization, this.config.metricsToken)) {
      response.status(401).type('text/plain; charset=utf-8').send('unauthorized\n');
      return;
    }
    const body = await this.metrics.render();
    response
      .status(200)
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(body);
  }
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
