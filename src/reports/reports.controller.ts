import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de facturación y estados' })
  summary(@Query() query: ReportQueryDto) {
    return this.service.summary(query);
  }

  @Get('tax')
  @ApiOperation({ summary: 'Totales por tasa tributaria configurada' })
  tax(@Query() query: ReportQueryDto) {
    return this.service.taxSummary(query);
  }

  @Get('by-customer')
  @ApiOperation({ summary: 'Ventas autorizadas por cliente' })
  byCustomer(@Query() query: ReportQueryDto) {
    return this.service.salesByCustomer(query);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Ventas autorizadas por día' })
  daily(@Query() query: ReportQueryDto) {
    return this.service.dailySales(query);
  }
}
