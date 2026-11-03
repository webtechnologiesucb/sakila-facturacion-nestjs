import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'NIT', description: 'Tipo de documento interno (no catálogo oficial)' })
  @IsString()
  @MaxLength(10)
  documentType!: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, { message: 'Número de documento inválido' })
  documentNumber!: string;

  @ApiProperty({ example: 'Cliente Demo SRL' })
  @IsString()
  @MinLength(2)
  @MaxLength(250)
  businessName!: string;

  @ApiPropertyOptional({ example: 'cliente@demo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+591 70000000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Av. Demo 123, La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 'EMPRESA' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxpayerType?: string;

  @ApiPropertyOptional({ description: 'ID de cliente Sakila de referencia', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sakilaCustomerId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
