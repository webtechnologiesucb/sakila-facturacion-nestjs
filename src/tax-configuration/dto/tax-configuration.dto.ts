import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TaxEnvironment, TaxModality, ValidationStatus } from '@prisma/client';
import { IsDecimalValue } from '../../common/validators/is-decimal-value.validator';

export const ROUNDING_MODES = [
  'ROUND_UP',
  'ROUND_DOWN',
  'ROUND_HALF_UP',
  'ROUND_HALF_EVEN',
] as const;

export class CreateIssuerDto {
  @ApiProperty({ example: '1234567890', description: 'NIT del emisor (dato ficticio en la demo)' })
  @IsString()
  @Matches(/^[0-9]{5,20}$/, { message: 'NIT inválido' })
  nit!: string;

  @ApiProperty({ example: 'Sakila Emisor Demo SRL' })
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  legalName!: string;

  @ApiPropertyOptional({ example: 'Sakila Demo' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  businessName?: string;

  @ApiPropertyOptional({ example: '620100', description: 'Código de actividad económica (configurable)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  economicActivityCode?: string;

  @ApiProperty({ example: 'Av. Demo 123, La Paz' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateIssuerDto extends PartialType(CreateIssuerDto) {}

export class CreateBranchDto {
  @ApiProperty({ example: 'SUC-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'Código de sucursal inválido' })
  code!: string;

  @ApiProperty({ example: 'Sucursal Central' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'Av. Demo 123, La Paz' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address!: string;

  @ApiPropertyOptional({ example: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipality?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class CreatePointOfSaleDto {
  @ApiProperty({ example: 'PV-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'Código de punto de venta inválido' })
  code!: string;

  @ApiProperty({ example: 'Caja 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePointOfSaleDto extends PartialType(CreatePointOfSaleDto) {}

export class CreateTaxConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  issuerId!: string;

  @ApiProperty({ example: 'Configuración base 2026' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: TaxEnvironment, default: TaxEnvironment.SIMULATED })
  @IsOptional()
  @IsEnum(TaxEnvironment)
  environment?: TaxEnvironment;

  @ApiPropertyOptional({ enum: TaxModality, default: TaxModality.ELECTRONICA_EN_LINEA })
  @IsOptional()
  @IsEnum(TaxModality)
  modality?: TaxModality;

  @ApiPropertyOptional({ default: 'BOB' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Moneda ISO 4217 de 3 letras' })
  currency?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  priceIncludesTax?: boolean;

  @ApiPropertyOptional({ example: '0.130000', description: 'Tasa por defecto configurable' })
  @IsOptional()
  @IsDecimalValue({ min: 0, max: 1, decimalPlaces: 6 })
  defaultTaxRate?: string | number;

  @ApiPropertyOptional({ enum: ROUNDING_MODES, default: 'ROUND_HALF_UP' })
  @IsOptional()
  @IsIn(ROUNDING_MODES)
  roundingMode?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({
    example: 'Configuración interna de demostración. Regla pendiente de verificación oficial.',
    description: 'Fuente o referencia obligatoria de la configuración',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  sourceReference!: string;

  @ApiPropertyOptional({ enum: ValidationStatus, default: ValidationStatus.PENDING_VERIFICATION })
  @IsOptional()
  @IsEnum(ValidationStatus)
  validationStatus?: ValidationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  verifiedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateTaxConfigurationDto extends PartialType(CreateTaxConfigurationDto) {}

export class CreateTaxRuleDto {
  @ApiProperty({ example: 'IVA' })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: 'Impuesto al Valor Agregado (demo)' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'IVA', description: 'Tipo tributario interno configurable' })
  @IsString()
  @MaxLength(30)
  taxType!: string;

  @ApiProperty({ example: '0.130000' })
  @IsDecimalValue({ min: 0, max: 1, decimalPlaces: 6 })
  rate!: string | number;

  @ApiProperty({ example: 'Valor de demostración. Verificar normativa vigente antes de usar.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  sourceReference!: string;

  @ApiPropertyOptional({ enum: ValidationStatus, default: ValidationStatus.PENDING_VERIFICATION })
  @IsOptional()
  @IsEnum(ValidationStatus)
  validationStatus?: ValidationStatus;
}

export class UpdateTaxRuleDto extends PartialType(CreateTaxRuleDto) {}
