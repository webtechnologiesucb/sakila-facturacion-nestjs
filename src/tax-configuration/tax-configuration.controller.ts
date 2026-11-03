import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TaxConfigurationService } from './tax-configuration.service';
import {
  CreateBranchDto,
  CreateIssuerDto,
  CreatePointOfSaleDto,
  CreateTaxConfigurationDto,
  CreateTaxRuleDto,
  UpdateBranchDto,
  UpdateIssuerDto,
  UpdatePointOfSaleDto,
  UpdateTaxConfigurationDto,
  UpdateTaxRuleDto,
} from './dto/tax-configuration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/decorators/auth.decorators';

function auditContext(user: AuthenticatedUser, req: any) {
  return { actorId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] };
}

@ApiTags('issuers')
@ApiBearerAuth()
@Controller('issuers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuersController {
  constructor(private readonly service: TaxConfigurationService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear emisor fiscal' })
  create(@Body() dto: CreateIssuerDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.service.createIssuer(dto, auditContext(user, req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar emisores con sucursales y configuraciones' })
  list() {
    return this.service.listIssuers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener emisor' })
  findOne(@Param('id') id: string) {
    return this.service.findIssuer(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar emisor' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIssuerDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.updateIssuer(id, dto, auditContext(user, req));
  }

  @Post(':issuerId/branches')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear sucursal de un emisor' })
  createBranch(
    @Param('issuerId') issuerId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.createBranch(issuerId, dto, auditContext(user, req));
  }

  @Get(':issuerId/branches')
  @ApiOperation({ summary: 'Listar sucursales de un emisor' })
  listBranches(@Param('issuerId') issuerId: string) {
    return this.service.listBranches(issuerId);
  }
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly service: TaxConfigurationService) {}

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar sucursal' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.updateBranch(id, dto, auditContext(user, req));
  }

  @Post(':branchId/points-of-sale')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear punto de venta de una sucursal' })
  createPointOfSale(
    @Param('branchId') branchId: string,
    @Body() dto: CreatePointOfSaleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.createPointOfSale(branchId, dto, auditContext(user, req));
  }

  @Get(':branchId/points-of-sale')
  @ApiOperation({ summary: 'Listar puntos de venta de una sucursal' })
  listPointsOfSale(@Param('branchId') branchId: string) {
    return this.service.listPointsOfSale(branchId);
  }
}

@ApiTags('points-of-sale')
@ApiBearerAuth()
@Controller('points-of-sale')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PointsOfSaleController {
  constructor(private readonly service: TaxConfigurationService) {}

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar punto de venta' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePointOfSaleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.updatePointOfSale(id, dto, auditContext(user, req));
  }
}

@ApiTags('tax-configuration')
@ApiBearerAuth()
@Controller('tax-configurations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxConfigurationController {
  constructor(private readonly service: TaxConfigurationService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear configuración tributaria versionada' })
  create(
    @Body() dto: CreateTaxConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.createConfiguration(dto, auditContext(user, req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar configuraciones tributarias' })
  list(@Query('issuerId') issuerId?: string) {
    return this.service.listConfigurations(issuerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener configuración tributaria con reglas' })
  findOne(@Param('id') id: string) {
    return this.service.findConfiguration(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar configuración tributaria' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxConfigurationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.updateConfiguration(id, dto, auditContext(user, req));
  }

  @Post(':id/rules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Agregar regla tributaria a una configuración' })
  createRule(
    @Param('id') id: string,
    @Body() dto: CreateTaxRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.createRule(id, dto, auditContext(user, req));
  }

  @Get(':id/rules')
  @ApiOperation({ summary: 'Listar reglas de una configuración' })
  listRules(@Param('id') id: string) {
    return this.service.listRules(id);
  }
}

@ApiTags('tax-rules')
@ApiBearerAuth()
@Controller('tax-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxRulesController {
  constructor(private readonly service: TaxConfigurationService) {}

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar regla tributaria' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.service.updateRule(id, dto, auditContext(user, req));
  }
}
