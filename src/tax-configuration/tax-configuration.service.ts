import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TaxConfiguration,
  TaxEnvironment,
  TaxModality,
  ValidationStatus,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
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

@Injectable()
export class TaxConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------------------------
  // Emisores
  // --------------------------------------------------------------------------

  async createIssuer(dto: CreateIssuerDto, ctx: AuditContext) {
    try {
      const issuer = await this.prisma.issuer.create({ data: { ...dto } });
      await this.audit.log('ISSUER_CREATE', 'tax_issuers', issuer.id, null, issuer, ctx);
      return issuer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un emisor con ese NIT');
      }
      throw error;
    }
  }

  listIssuers() {
    return this.prisma.issuer.findMany({
      orderBy: { legalName: 'asc' },
      include: {
        branches: { include: { pointsOfSale: true } },
        configurations: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            name: true,
            version: true,
            environment: true,
            modality: true,
            active: true,
            validationStatus: true,
          },
        },
      },
    });
  }

  async findIssuer(id: string) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id },
      include: {
        branches: { include: { pointsOfSale: true } },
        configurations: { include: { rules: true }, orderBy: { version: 'desc' } },
      },
    });
    if (!issuer) throw new NotFoundException('Emisor no encontrado');
    return issuer;
  }

  async updateIssuer(id: string, dto: UpdateIssuerDto, ctx: AuditContext) {
    const before = await this.findIssuer(id);
    try {
      const after = await this.prisma.issuer.update({ where: { id }, data: { ...dto } });
      await this.audit.log('ISSUER_UPDATE', 'tax_issuers', id, before, after, ctx);
      return after;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un emisor con ese NIT');
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Sucursales y puntos de venta
  // --------------------------------------------------------------------------

  async createBranch(issuerId: string, dto: CreateBranchDto, ctx: AuditContext) {
    await this.ensureIssuer(issuerId);
    try {
      const branch = await this.prisma.branch.create({ data: { ...dto, issuerId } });
      await this.audit.log('BRANCH_CREATE', 'tax_branches', branch.id, null, branch, ctx);
      return branch;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una sucursal con ese código para el emisor');
      }
      throw error;
    }
  }

  listBranches(issuerId: string) {
    return this.prisma.branch.findMany({
      where: { issuerId },
      orderBy: { code: 'asc' },
      include: { pointsOfSale: { orderBy: { code: 'asc' } } },
    });
  }

  async updateBranch(id: string, dto: UpdateBranchDto, ctx: AuditContext) {
    const before = await this.prisma.branch.findUnique({
      where: { id },
      include: { pointsOfSale: true },
    });
    if (!before) throw new NotFoundException('Sucursal no encontrada');
    const after = await this.prisma.branch.update({ where: { id }, data: { ...dto } });
    await this.audit.log('BRANCH_UPDATE', 'tax_branches', id, before, after, ctx);
    return after;
  }

  async createPointOfSale(branchId: string, dto: CreatePointOfSaleDto, ctx: AuditContext) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('La sucursal indicada no existe');
    try {
      const pointOfSale = await this.prisma.pointOfSale.create({
        data: { ...dto, branchId },
      });
      await this.audit.log(
        'POINT_OF_SALE_CREATE',
        'tax_points_of_sale',
        pointOfSale.id,
        null,
        pointOfSale,
        ctx,
      );
      return pointOfSale;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un punto de venta con ese código en la sucursal');
      }
      throw error;
    }
  }

  listPointsOfSale(branchId: string) {
    return this.prisma.pointOfSale.findMany({
      where: { branchId },
      orderBy: { code: 'asc' },
    });
  }

  async updatePointOfSale(id: string, dto: UpdatePointOfSaleDto, ctx: AuditContext) {
    const before = await this.prisma.pointOfSale.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Punto de venta no encontrado');
    const after = await this.prisma.pointOfSale.update({ where: { id }, data: { ...dto } });
    await this.audit.log('POINT_OF_SALE_UPDATE', 'tax_points_of_sale', id, before, after, ctx);
    return after;
  }

  // --------------------------------------------------------------------------
  // Configuración tributaria versionada
  // --------------------------------------------------------------------------

  async createConfiguration(dto: CreateTaxConfigurationDto, ctx: AuditContext) {
    await this.ensureIssuer(dto.issuerId);
    if (dto.effectiveTo && dto.effectiveFrom) {
      if (new Date(dto.effectiveTo) <= new Date(dto.effectiveFrom)) {
        throw new BadRequestException('effectiveTo debe ser posterior a effectiveFrom');
      }
    }

    try {
      const configuration = await this.prisma.taxConfiguration.create({
        data: {
          issuerId: dto.issuerId,
          name: dto.name,
          version: dto.version,
          environment: dto.environment ?? TaxEnvironment.SIMULATED,
          modality: dto.modality ?? TaxModality.ELECTRONICA_EN_LINEA,
          currency: dto.currency ?? 'BOB',
          priceIncludesTax: dto.priceIncludesTax ?? false,
          defaultTaxRate: new Decimal(dto.defaultTaxRate ?? 0).toFixed(6),
          roundingMode: dto.roundingMode ?? 'ROUND_HALF_UP',
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          sourceReference: dto.sourceReference,
          validationStatus: dto.validationStatus ?? ValidationStatus.PENDING_VERIFICATION,
          verifiedBy: dto.verifiedBy,
          notes: dto.notes,
          active: dto.active ?? true,
        },
      });
      await this.audit.log(
        'TAX_CONFIGURATION_CREATE',
        'tax_configurations',
        configuration.id,
        null,
        configuration,
        ctx,
      );
      return configuration;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una configuración con esa versión para el emisor');
      }
      throw error;
    }
  }

  listConfigurations(issuerId?: string) {
    return this.prisma.taxConfiguration.findMany({
      where: issuerId ? { issuerId } : {},
      orderBy: [{ issuerId: 'asc' }, { version: 'desc' }],
      include: { rules: true, issuer: { select: { id: true, nit: true, legalName: true } } },
    });
  }

  async findConfiguration(id: string) {
    const configuration = await this.prisma.taxConfiguration.findUnique({
      where: { id },
      include: {
        rules: true,
        issuer: { select: { id: true, nit: true, legalName: true } },
      },
    });
    if (!configuration) throw new NotFoundException('Configuración tributaria no encontrada');
    return configuration;
  }

  async updateConfiguration(id: string, dto: UpdateTaxConfigurationDto, ctx: AuditContext) {
    const before = await this.findConfiguration(id);
    if (dto.effectiveTo) {
      const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : before.effectiveFrom;
      if (new Date(dto.effectiveTo) <= from) {
        throw new BadRequestException('effectiveTo debe ser posterior a effectiveFrom');
      }
    }
    if (dto.issuerId) await this.ensureIssuer(dto.issuerId);

    const after = await this.prisma.taxConfiguration.update({
      where: { id },
      data: {
        ...(dto.issuerId !== undefined ? { issuerId: dto.issuerId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.environment !== undefined ? { environment: dto.environment } : {}),
        ...(dto.modality !== undefined ? { modality: dto.modality } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.priceIncludesTax !== undefined
          ? { priceIncludesTax: dto.priceIncludesTax }
          : {}),
        ...(dto.defaultTaxRate !== undefined
          ? { defaultTaxRate: new Decimal(dto.defaultTaxRate).toFixed(6) }
          : {}),
        ...(dto.roundingMode !== undefined ? { roundingMode: dto.roundingMode } : {}),
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(dto.effectiveFrom) }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null }
          : {}),
        ...(dto.sourceReference !== undefined
          ? { sourceReference: dto.sourceReference }
          : {}),
        ...(dto.validationStatus !== undefined
          ? { validationStatus: dto.validationStatus }
          : {}),
        ...(dto.verifiedBy !== undefined ? { verifiedBy: dto.verifiedBy } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit.log(
      'TAX_CONFIGURATION_UPDATE',
      'tax_configurations',
      id,
      before,
      after,
      ctx,
    );
    return after;
  }

  async getEffectiveConfiguration(issuerId: string): Promise<TaxConfiguration> {
    const now = new Date();
    const configuration = await this.prisma.taxConfiguration.findFirst({
      where: {
        issuerId,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: { version: 'desc' },
    });
    if (!configuration) {
      throw new BadRequestException(
        'El emisor no tiene una configuración tributaria activa y vigente',
      );
    }
    return configuration;
  }

  // --------------------------------------------------------------------------
  // Reglas tributarias
  // --------------------------------------------------------------------------

  async createRule(configurationId: string, dto: CreateTaxRuleDto, ctx: AuditContext) {
    await this.findConfiguration(configurationId);
    try {
      const rule = await this.prisma.taxRule.create({
        data: {
          configurationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name,
          taxType: dto.taxType,
          rate: new Decimal(dto.rate).toFixed(6),
          sourceReference: dto.sourceReference,
          validationStatus: dto.validationStatus ?? ValidationStatus.PENDING_VERIFICATION,
        },
      });
      await this.audit.log('TAX_RULE_CREATE', 'tax_rules', rule.id, null, rule, ctx);
      return rule;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una regla con ese código en la configuración');
      }
      throw error;
    }
  }

  listRules(configurationId: string) {
    return this.prisma.taxRule.findMany({
      where: { configurationId },
      orderBy: { code: 'asc' },
    });
  }

  async updateRule(id: string, dto: UpdateTaxRuleDto, ctx: AuditContext) {
    const before = await this.prisma.taxRule.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Regla tributaria no encontrada');
    const after = await this.prisma.taxRule.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.taxType !== undefined ? { taxType: dto.taxType } : {}),
        ...(dto.rate !== undefined ? { rate: new Decimal(dto.rate).toFixed(6) } : {}),
        ...(dto.sourceReference !== undefined
          ? { sourceReference: dto.sourceReference }
          : {}),
        ...(dto.validationStatus !== undefined
          ? { validationStatus: dto.validationStatus }
          : {}),
      },
    });
    await this.audit.log('TAX_RULE_UPDATE', 'tax_rules', id, before, after, ctx);
    return after;
  }

  private async ensureIssuer(issuerId: string): Promise<void> {
    const issuer = await this.prisma.issuer.findUnique({ where: { id: issuerId } });
    if (!issuer) throw new BadRequestException('El emisor indicado no existe');
  }
}
