import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'facturador@demo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Facturador Demo' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: 'Facturador123!',
    description: 'Mínimo 12 caracteres, mayúscula, minúscula, número y símbolo',
  })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo',
  })
  password!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.VIEWER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
