import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CancellationService } from './cancellation.service';
import {
  CreateCancellationDto,
  ReverseCancellationDto,
} from './dto/cancellation.dto';
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

@ApiTags('cancellations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CancellationController {
  constructor(private readonly service: CancellationService) {}

  @Post('invoices/:invoiceId/cancellation-requests')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Solicitar anulación de una factura autorizada' })
  request(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateCancellationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.request(invoiceId, user.id, dto, auditContext(user, req));
  }

  @Get('invoices/:invoiceId/cancellation-requests')
  @ApiOperation({ summary: 'Listar solicitudes de anulación de una factura' })
  listByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.service.list(invoiceId);
  }

  @Get('cancellation-requests')
  @ApiOperation({ summary: 'Listar todas las solicitudes de anulación' })
  list() {
    return this.service.list();
  }

  @Post('cancellation-requests/:id/reverse')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Revertir una anulación aprobada (solo ADMIN)' })
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseCancellationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.reverse(id, user.id, dto.reason, auditContext(user, req));
  }
}
