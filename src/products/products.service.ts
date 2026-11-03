import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------------------------
  // Categorías fiscales
  // --------------------------------------------------------------------------

  async createCategory(dto: CreateCategoryDto, ctx: AuditContext) {
    if (dto.sakilaCategoryId) {
      const sakila = await this.prisma.sakilaCategory.findUnique({
        where: { categoryId: dto.sakilaCategoryId },
      });
      if (!sakila) throw new NotFoundException('Categoría Sakila referenciada no existe');
    }
    try {
      const category = await this.prisma.productCategory.create({ data: { ...dto } });
      await this.audit.log(
        'CATEGORY_CREATE',
        'tax_product_categories',
        category.id,
        null,
        category,
        ctx,
      );
      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('La categoría ya está vinculada a esa categoría Sakila');
      }
      throw error;
    }
  }

  async listCategories() {
    return this.prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: { sakilaCategory: { select: { categoryId: true, name: true } } },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, ctx: AuditContext) {
    const before = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Categoría no encontrada');
    const after = await this.prisma.productCategory.update({ where: { id }, data: { ...dto } });
    await this.audit.log(
      'CATEGORY_UPDATE',
      'tax_product_categories',
      id,
      before,
      after,
      ctx,
    );
    return after;
  }

  // --------------------------------------------------------------------------
  // Productos fiscales
  // --------------------------------------------------------------------------

  async createProduct(dto: CreateProductDto, ctx: AuditContext) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('La categoría indicada no existe');

    if (dto.sakilaFilmId) {
      const film = await this.prisma.sakilaFilm.findUnique({
        where: { filmId: dto.sakilaFilmId },
      });
      if (!film) throw new BadRequestException('La película Sakila indicada no existe');
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          categoryId: dto.categoryId,
          sku: dto.sku.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description,
          unitOfMeasure: dto.unitOfMeasure,
          unitPrice: new Decimal(dto.unitPrice).toFixed(4),
          taxCode: dto.taxCode,
          taxRate: new Decimal(dto.taxRate).toFixed(6),
          taxIncluded: dto.taxIncluded ?? false,
          sakilaFilmId: dto.sakilaFilmId,
          active: dto.active ?? true,
        },
      });
      await this.audit.log('PRODUCT_CREATE', 'tax_products', product.id, null, product, ctx);
      return product;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un producto con ese SKU o vínculo Sakila');
      }
      throw error;
    }
  }

  async listProducts(query: ProductQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.active !== undefined && query.active !== ''
        ? { active: query.active === 'true' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        sakilaFilm: { select: { filmId: true, title: true } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto, ctx: AuditContext) {
    const before = await this.findProduct(id);

    if (dto.categoryId) {
      const category = await this.prisma.productCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new BadRequestException('La categoría indicada no existe');
    }
    if (dto.sakilaFilmId) {
      const film = await this.prisma.sakilaFilm.findUnique({
        where: { filmId: dto.sakilaFilmId },
      });
      if (!film) throw new BadRequestException('La película Sakila indicada no existe');
    }

    try {
      const after = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.unitOfMeasure !== undefined ? { unitOfMeasure: dto.unitOfMeasure } : {}),
          ...(dto.unitPrice !== undefined
            ? { unitPrice: new Decimal(dto.unitPrice).toFixed(4) }
            : {}),
          ...(dto.taxCode !== undefined ? { taxCode: dto.taxCode } : {}),
          ...(dto.taxRate !== undefined
            ? { taxRate: new Decimal(dto.taxRate).toFixed(6) }
            : {}),
          ...(dto.taxIncluded !== undefined ? { taxIncluded: dto.taxIncluded } : {}),
          ...(dto.sakilaFilmId !== undefined ? { sakilaFilmId: dto.sakilaFilmId } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      await this.audit.log('PRODUCT_UPDATE', 'tax_products', id, before, after, ctx);
      return after;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un producto con ese SKU o vínculo Sakila');
      }
      throw error;
    }
  }
}
