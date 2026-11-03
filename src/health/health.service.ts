import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness() {
    return {
      status: 'ok',
      service: 'sakila-facturacion-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      siatMode: process.env.SIAT_MODE || 'simulated',
      certified: false,
      disclaimer: 'Prototipo académico no certificado por el SIN',
    };
  }

  async readiness() {
    const dbOk = await this.prisma.isHealthy();
    return {
      status: dbOk ? 'ready' : 'not-ready',
      ready: dbOk,
      database: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
