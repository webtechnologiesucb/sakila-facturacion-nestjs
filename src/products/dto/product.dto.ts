import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsDecimalValue } from '../../common/validators/is-decimal-value.validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Categoría fiscal', format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'SRV-001' })
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{2,60}$/, { message: 'SKU inválido' })
  sku!: string;

  @ApiProperty({ example: 'Suscripción mensual' })
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ example: 'UNIDAD', description: 'Unidad de medida interna (no catálogo oficial)' })
  @IsString()
  @MaxLength(20)
  unitOfMeasure!: string;

  @ApiProperty({ example: '100.0000' })
  @IsDecimalValue({ min: 0, decimalPlaces: 4 })
  unitPrice!: string | number;

  @ApiPropertyOptional({ example: 'IVA', description: 'Código tributario configurable' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxCode?: string;

  @ApiProperty({ example: '0.130000', description: 'Tasa configurable, no constante oficial' })
  @IsDecimalValue({ min: 0, max: 1, decimalPlaces: 6 })
  taxRate!: string | number;

  @ApiPropertyOptional({ default: false, description: 'El precio unitario ya incluye impuesto' })
  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @ApiPropertyOptional({ description: 'Película Sakila de referencia', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sakilaFilmId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  active?: string;
}
