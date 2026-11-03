import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check básico (liveness)' })
  @ApiResponse({ status: 200, description: 'Servicio disponible' })
  health() {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check con verificación de PostgreSQL' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.readiness();
    if (!result.ready) {
      res.status(503);
    }
    return result;
  }
}
