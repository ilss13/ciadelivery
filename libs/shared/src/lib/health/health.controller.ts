import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

class HealthStatusResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Process health' })
  @ApiOkResponse({ type: HealthStatusResponse })
  healthCheck(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ type: HealthStatusResponse })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({ type: HealthStatusResponse })
  @ApiServiceUnavailableResponse({ type: HealthStatusResponse })
  async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ok' | 'unavailable' }> {
    const result = await this.health.readiness();
    response.status(result.httpStatus);
    return { status: result.status };
  }
}
