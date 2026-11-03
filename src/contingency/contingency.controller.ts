import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContingencyStatus, UserRole } from '@prisma/client';
import { ContingencyService } from './contingency.service';
import {
  CloseContingencyDto,
  CreateContingencyDto,
  ReportContingencyDto,
} from './dto/contingency.dto';
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

@ApiTags('contingency')
@ApiBearerAuth()
@Controller('contingencies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContingencyController {
  constructor(private readonly service: ContingencyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Abrir evento de contingencia' })
  create(
    @Body() dto: CreateContingencyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.create(dto, user.id, auditContext(user, req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar eventos de contingencia' })
  list(
    @Query('issuerId') issuerId?: string,
    @Query('status') status?: ContingencyStatus,
  ) {
    return this.service.list(issuerId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener evento de contingencia con facturas asociadas' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Cerrar evento de contingencia' })
  close(
    @Param('id') id: string,
    @Body() dto: CloseContingencyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.close(id, dto, auditContext(user, req));
  }

  @Post(':id/report')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Regularizar evento de contingencia (simulado)' })
  report(
    @Param('id') id: string,
    @Body() dto: ReportContingencyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.report(id, dto, auditContext(user, req));
  }

  @Post(':id/invoices/:invoiceId')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Asociar factura a un evento de contingencia abierto' })
  attach(
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.attachInvoice(id, invoiceId, auditContext(user, req));
  }
}
