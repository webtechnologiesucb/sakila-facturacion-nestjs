import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('info')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Información de la API y advertencia de alcance' })
  info() {
    return {
      name: 'Sakila Facturación Electrónica Boliviana',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      taxAuthorityMode: process.env.SIAT_MODE || 'simulated',
      certified: false,
      disclaimer:
        'Prototipo académico. No está certificado, homologado ni habilitado por el SIN. ' +
        'El adaptador por defecto es simulado y no emite documentos fiscales reales.',
      docs: '/docs',
    };
  }
}
