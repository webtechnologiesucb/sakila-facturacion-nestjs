import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContingencyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  issuerId!: string;

  @ApiProperty({ example: 'CORTE_DE_INTERNET', description: 'Tipo interno de evento' })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  type!: string;

  @ApiProperty({ example: 'Interrupción del servicio de internet en la sucursal central' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;
}

export class CloseContingencyDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Por defecto se usa la fecha actual' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

export class ReportContingencyDto {
  @ApiPropertyOptional({ description: 'Código de evento asignado por el proveedor (simulado)' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventCode?: string;
}
