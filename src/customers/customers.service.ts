import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, ctx: AuditContext) {
    if (dto.sakilaCustomerId) {
      const sakila = await this.prisma.sakilaCustomer.findUnique({
        where: { customerId: dto.sakilaCustomerId },
      });
      if (!sakila) throw new NotFoundException('Cliente Sakila referenciado no existe');
    }
    try {
      const customer = await this.prisma.customer.create({
        data: {
          ...dto,
          documentNumber: dto.documentNumber.trim(),
          businessName: dto.businessName.trim(),
        },
      });
      await this.audit.log('CUSTOMER_CREATE', 'tax_customers', customer.id, null, customer, ctx);
      return customer;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un cliente con ese tipo y número de documento');
      }
      throw error;
    }
  }

  async list(page: number, limit: number, search?: string) {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { businessName: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search } },
          ],
        }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, ctx: AuditContext) {
    const before = await this.findOne(id);
    try {
      const after = await this.prisma.customer.update({ where: { id }, data: dto });
      await this.audit.log('CUSTOMER_UPDATE', 'tax_customers', id, before, after, ctx);
      return after;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un cliente con ese tipo y número de documento');
      }
      throw error;
    }
  }
}
