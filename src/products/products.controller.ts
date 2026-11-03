import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/decorators/auth.decorators';

function auditContext(user: AuthenticatedUser, req: any) {
  return { actorId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] };
}

@ApiTags('product-categories')
@ApiBearerAuth()
@Controller('product-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductCategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Crear categoría fiscal de productos' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.productsService.createCategory(dto, auditContext(user, req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías fiscales' })
  list() {
    return this.productsService.listCategories();
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Actualizar categoría fiscal' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.productsService.updateCategory(id, dto, auditContext(user, req));
  }
}

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Crear producto/servicio facturable' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.productsService.createProduct(dto, auditContext(user, req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos fiscales' })
  list(@Query() query: ProductQueryDto) {
    return this.productsService.listProducts(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto fiscal' })
  findOne(@Param('id') id: string) {
    return this.productsService.findProduct(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BILLING)
  @ApiOperation({ summary: 'Actualizar producto fiscal' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.productsService.updateProduct(id, dto, auditContext(user, req));
  }
}
