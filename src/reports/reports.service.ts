import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

const AUTHORIZED_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.AUTORIZADA,
  InvoiceStatus.PENDIENTE_DE_ANULACION,
  InvoiceStatus.ANULADA,
];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: ReportQueryDto) {
    const { from, to } = this.range(query);
    const where: Prisma.InvoiceWhereInput = {
      ...(query.issuerId ? { issuerId: query.issuerId } : {}),
      issueDate: { gte: from, lte: to },
    };

    const [all, authorized, byStatus] = await Promise.all([
      this.prisma.invoice.aggregate({
        where,
        _count: { _all: true },
        _sum: { total: true, taxTotal: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: { in: AUTHORIZED_STATUSES } },
        _count: { _all: true },
        _sum: {
          subtotal: true,
          discountTotal: true,
          taxableBase: true,
          taxTotal: true,
          total: true,
        },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      issuerId: query.issuerId ?? null,
      allInvoices: {
        count: all._count._all,
        total: this.money(all._sum.total),
        taxTotal: this.money(all._sum.taxTotal),
      },
      authorizedInvoices: {
        count: authorized._count._all,
        subtotal: this.money(authorized._sum.subtotal),
        discountTotal: this.money(authorized._sum.discountTotal),
        taxableBase: this.money(authorized._sum.taxableBase),
        taxTotal: this.money(authorized._sum.taxTotal),
        total: this.money(authorized._sum.total),
      },
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        total: this.money(row._sum.total),
      })),
      disclaimer:
        'Reporte interno. No reemplaza libros fiscales oficiales ni reportes del SIN.',
    };
  }

  async taxSummary(query: ReportQueryDto) {
    const { from, to } = this.range(query);
    const grouped = await this.prisma.invoiceItem.groupBy({
      by: ['taxRate'],
      where: {
        invoice: {
          ...(query.issuerId ? { issuerId: query.issuerId } : {}),
          issueDate: { gte: from, lte: to },
          status: { in: AUTHORIZED_STATUSES },
        },
      },
      _count: true,
      _sum: { lineSubtotal: true, discount: true, taxAmount: true, lineTotal: true },
      orderBy: { taxRate: 'asc' },
    });

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      rates: grouped.map((row) => ({
        taxRate: new Decimal(row.taxRate).toFixed(6),
        lines: row._count,
        taxableBase: this.money(
          new Decimal(row._sum.lineSubtotal ?? 0).minus(row._sum.discount ?? 0),
        ),
        taxAmount: this.money(row._sum.taxAmount),
        lineTotal: this.money(row._sum.lineTotal),
      })),
      disclaimer:
        'Totales por tasa configurada. Las tasas son datos internos pendientes de verificación normativa.',
    };
  }

  async salesByCustomer(query: ReportQueryDto) {
    const { from, to } = this.range(query);
    const grouped = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where: {
        ...(query.issuerId ? { issuerId: query.issuerId } : {}),
        issueDate: { gte: from, lte: to },
        status: { in: AUTHORIZED_STATUSES },
      },
      _count: { _all: true },
      _sum: { total: true, taxTotal: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 50,
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((row) => row.customerId) } },
      select: { id: true, businessName: true, documentNumber: true, documentType: true },
    });
    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      customers: grouped.map((row) => ({
        customer: customerMap.get(row.customerId) ?? { id: row.customerId },
        invoiceCount: row._count._all,
        total: this.money(row._sum.total),
        taxTotal: this.money(row._sum.taxTotal),
      })),
    };
  }

  async dailySales(query: ReportQueryDto) {
    const { from, to } = this.range(query);
    const issuerFilter = query.issuerId
      ? Prisma.sql`AND f."issuer_id" = ${query.issuerId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; invoices: number; subtotal: string; tax: string; total: string }>
    >(Prisma.sql`
      SELECT
        date_trunc('day', f."issue_date") AS "day",
        COUNT(*)::int AS "invoices",
        COALESCE(SUM(f."subtotal"), 0)::text AS "subtotal",
        COALESCE(SUM(f."tax_total"), 0)::text AS "tax",
        COALESCE(SUM(f."total"), 0)::text AS "total"
      FROM "tax_invoices" f
      WHERE f."issue_date" >= ${from}
        AND f."issue_date" <= ${to}
        AND f."status"::text IN ('AUTORIZADA', 'PENDIENTE_DE_ANULACION', 'ANULADA')
        ${issuerFilter}
      GROUP BY date_trunc('day', f."issue_date")
      ORDER BY "day" ASC
    `);

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      days: rows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        invoices: Number(row.invoices),
        subtotal: this.money(row.subtotal),
        tax: this.money(row.tax),
        total: this.money(row.total),
      })),
    };
  }

  private range(query: ReportQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 3600 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    if (from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }
    return { from, to };
  }

  private money(value: Decimal | string | number | null | undefined): string {
    return new Decimal(value ?? 0).toFixed(2);
  }
}
