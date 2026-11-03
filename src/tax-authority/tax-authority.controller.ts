import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TaxAuthorityService } from './tax-authority.service';
import { CufdRequestDto } from './dto/cufd-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';

@ApiTags('tax-authority')
@ApiBearerAuth()
@Controller('tax-authority')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxAuthorityController {
  constructor(private readonly service: TaxAuthorityService) {}

  @Get('status')
  @ApiOperation({ summary: 'Estado del proveedor tributario y comunicación simulada' })
  async status(
    @Query('issuerId') issuerId?: string,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    if (!issuerId) {
      return {
        provider: this.service.providerInfo(),
        note: 'Indique issuerId para verificar la comunicación con el contexto del emisor.',
      };
    }
    return this.service.status(issuerId, pointOfSaleId);
  }

  @Post('cufd')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Solicitar CUFD simulado para un emisor' })
  requestCufd(@Body() dto: CufdRequestDto, @Req() _req: any) {
    return this.service.requestCufd(dto.issuerId, dto.pointOfSaleId);
  }
}
