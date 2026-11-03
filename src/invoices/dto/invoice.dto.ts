import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DocumentType, InvoiceStatus } from '@prisma/client';
import { IsDecimalValue } from '../../common/validators/is-decimal-value.validator';

export class InvoiceItemDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Producto fiscal; si se omite use descripción y precio' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'Suscripción mensual' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'SRV-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCode?: string;

  @ApiPropertyOptional({ example: 'UNIDAD' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitOfMeasure?: string;

  @ApiProperty({ example: '2' })
  @IsDecimalValue({ min: 0, decimalPlaces: 4 })
  quantity!: string | number;

  @ApiPropertyOptional({ example: '100.0000', description: 'Si se omite se usa el precio del producto' })
  @IsOptional()
  @IsDecimalValue({ min: 0, decimalPlaces: 4 })
  unitPrice?: string | number;

  @ApiPropertyOptional({ example: '0.0000' })
  @IsOptional()
  @IsDecimalValue({ min: 0, decimalPlaces: 4 })
  discount?: string | number;

  @ApiPropertyOptional({ example: '0.130000', description: 'Si se omite se usa la tasa del producto o configuración' })
  @IsOptional()
  @IsDecimalValue({ min: 0, max: 1, decimalPlaces: 6 })
  taxRate?: string | number;

  @ApiPropertyOptional({ example: 'IVA' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxCode?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  issuerId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pointOfSaleId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si se omite se usa la configuración vigente' })
  @IsOptional()
  @IsUUID()
  configurationId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ enum: DocumentType, default: DocumentType.FACTURA })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Factura original para notas de crédito/débito' })
  @IsOptional()
  @IsUUID()
  originalInvoiceId?: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'Serie inválida' })
  serie!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: 'BOB' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: '1.000000' })
  @IsOptional()
  @IsDecimalValue({ min: 0, decimalPlaces: 6 })
  exchangeRate?: string | number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Evento de contingencia abierto' })
  @IsOptional()
  @IsUUID()
  contingencyId?: string;

  @ApiPropertyOptional({ description: 'Clave de idempotencia; también se acepta el header Idempotency-Key' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  issuerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
