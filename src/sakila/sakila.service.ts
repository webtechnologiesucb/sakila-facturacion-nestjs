import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SakilaService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(page: number, limit: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sakilaCustomer.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { customerId: 'asc' },
        select: {
          customerId: true,
          storeId: true,
          firstName: true,
          lastName: true,
          email: true,
          activebool: true,
          taxCustomer: { select: { id: true, documentType: true, documentNumber: true } },
        },
      }),
      this.prisma.sakilaCustomer.count(),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomer(id: number) {
    const customer = await this.prisma.sakilaCustomer.findUnique({
      where: { customerId: id },
      include: { taxCustomer: true },
    });
    if (!customer) throw new NotFoundException('Cliente Sakila no encontrado');
    return customer;
  }

  async listFilms(page: number, limit: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sakilaFilm.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { filmId: 'asc' },
        select: {
          filmId: true,
          title: true,
          description: true,
          rentalRate: true,
          rating: true,
          releaseYear: true,
          taxProduct: { select: { id: true, sku: true, unitPrice: true } },
          filmCategories: { select: { category: { select: { categoryId: true, name: true } } } },
        },
      }),
      this.prisma.sakilaFilm.count(),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFilm(id: number) {
    const film = await this.prisma.sakilaFilm.findUnique({
      where: { filmId: id },
      include: {
        taxProduct: true,
        filmCategories: { include: { category: true } },
        filmActors: { include: { actor: true } },
      },
    });
    if (!film) throw new NotFoundException('Película Sakila no encontrada');
    return film;
  }

  async listCategories() {
    return this.prisma.sakilaCategory.findMany({
      orderBy: { categoryId: 'asc' },
      include: { productCategories: { select: { id: true, name: true } } },
    });
  }

  mapping() {
    return {
      disclaimer:
        'Sakila es una base de ejemplo comercial. Ninguna tabla Sakila es un documento fiscal.',
      mappings: [
        { source: 'customer', target: 'tax_customers', rule: 'Datos personales/dirección como referencia; se exige documento fiscal propio.' },
        { source: 'film', target: 'tax_products', rule: 'Película como producto/servicio facturable; precio y tributo se definen en tax_products.' },
        { source: 'category', target: 'tax_product_categories', rule: 'Categoría comercial referencial, no catálogo tributario oficial.' },
        { source: 'film_category', target: 'tax_products.category_id', rule: 'Relación many-to-many Sakila simplificada a categoría principal.' },
        { source: 'inventory', target: '(sin equivalente fiscal)', rule: 'Stock físico no interviene en el documento tributario.' },
        { source: 'store', target: 'tax_branches', rule: 'Sucursal comercial puede inspirar una sucursal fiscal, pero requiere código SIN.' },
        { source: 'staff', target: 'users', rule: 'No se reutilizan contraseñas Sakila; autenticación propia.' },
        { source: 'rental', target: 'tax_invoices', rule: 'Un alquiler NO es factura. Se requiere transformación explícita con datos fiscales.' },
        { source: 'payment', target: '(sin equivalente fiscal)', rule: 'Pago comercial no es factura; jamás se usa como tabla fiscal.' },
      ],
    };
  }
}
