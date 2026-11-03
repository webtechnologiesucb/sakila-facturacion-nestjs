import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CufdRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  issuerId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Punto de venta para derivar el contexto' })
  @IsOptional()
  @IsUUID()
  pointOfSaleId?: string;

  @ApiPropertyOptional({ description: 'Identificador de correlación para trazabilidad' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
