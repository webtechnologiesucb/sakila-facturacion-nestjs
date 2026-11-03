import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, InvoiceQueryDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/decorators/auth.decorators';

function auditContext(user: AuthenticatedUser, req: any) {
  return {
    actorId: user.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    correlationId: req.headers['x-request-id'] || req.requestId,
  };
}

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Crear factura en borrador (idempotente)' })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.invoicesService.create(dto, auditContext(user, req), idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Listar facturas con filtros' })
  list(@Query() query: InvoiceQueryDto) {
    return this.invoicesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener factura con líneas, eventos y documento' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/xml')
  @ApiOperation({ summary: 'Obtener XML simulado de una factura emitida' })
  getXml(@Param('id') id: string) {
    return this.invoicesService.getXml(id);
  }

  @Get(':id/xml/download')
  @ApiOperation({ summary: 'Descargar XML simulado como archivo' })
  async downloadXml(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.invoicesService.getXml(id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.publicId}.xml"`,
    );
    return { __raw: true, body: document.xml };
  }

  @Post(':id/emit')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Emitir: CUF, XML simulado, firma simulada y congelamiento' })
  emit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.invoicesService.emit(id, auditContext(user, req));
  }

  @Post(':id/send')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Enviar al proveedor tributario (simulado por defecto)' })
  send(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.invoicesService.send(id, auditContext(user, req));
  }
}
