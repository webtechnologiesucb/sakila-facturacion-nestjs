import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCancellationDto {
  @ApiProperty({ example: 'Anulación solicitada por error en los datos del comprador' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class ReverseCancellationDto {
  @ApiProperty({ example: 'Reversión autorizada por el área tributaria' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}
