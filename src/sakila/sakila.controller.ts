import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SakilaService } from './sakila.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('sakila')
@ApiBearerAuth()
@Controller('sakila')
@UseGuards(JwtAuthGuard)
export class SakilaController {
  constructor(private readonly sakilaService: SakilaService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Listar clientes Sakila (referencia comercial)' })
  customers(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.sakilaService.listCustomers(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Obtener cliente Sakila' })
  customer(@Param('id', ParseIntPipe) id: number) {
    return this.sakilaService.getCustomer(id);
  }

  @Get('films')
  @ApiOperation({ summary: 'Listar películas Sakila adaptadas a productos' })
  films(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.sakilaService.listFilms(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }

  @Get('films/:id')
  @ApiOperation({ summary: 'Obtener película Sakila' })
  film(@Param('id', ParseIntPipe) id: number) {
    return this.sakilaService.getFilm(id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías Sakila' })
  categories() {
    return this.sakilaService.listCategories();
  }

  @Get('mapping')
  @ApiOperation({ summary: 'Documentar el mapeo Sakila → modelo fiscal' })
  mapping() {
    return this.sakilaService.mapping();
  }
}
