import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContingencyStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import {
  CloseContingencyDto,
  CreateContingencyDto,
  ReportContingencyDto,
} from './dto/contingency.dto';

@Injectable()
export class ContingencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateContingencyDto, userId: string, ctx: AuditContext) {
    const issuer = await this.prisma.issuer.findUnique({ where: { id: dto.issuerId } });
    if (!issuer) throw new BadRequestException('El emisor indicado no existe');

    const open = await this.prisma.contingencyEvent.findFirst({
      where: { issuerId: dto.issuerId, status: ContingencyStatus.ABIERTA },
    });
    if (open) {
      throw new ConflictException('Ya existe un evento de contingencia abierto para el emisor');
    }

    const event = await this.prisma.contingencyEvent.create({
      data: {
        issuerId: dto.issuerId,
        type: dto.type,
        description: dto.description,
        status: ContingencyStatus.ABIERTA,
        createdBy: userId,
      },
    });
    await this.audit.log('CONTINGENCY_CREATE', 'tax_contingency_events', event.id, null, event, ctx);
    return event;
  }

  list(issuerId?: string, status?: ContingencyStatus) {
    const where: Prisma.ContingencyEventWhereInput = {
      ...(issuerId ? { issuerId } : {}),
      ...(status ? { status } : {}),
    };
    return this.prisma.contingencyEvent.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        issuer: { select: { id: true, nit: true, legalName: true } },
        _count: { select: { invoices: true } },
      },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.contingencyEvent.findUnique({
      where: { id },
      include: {
        issuer: { select: { id: true, nit: true, legalName: true } },
        invoices: {
          select: {
            id: true,
            publicId: true,
            status: true,
            total: true,
            issueDate: true,
          },
          orderBy: { issueDate: 'desc' },
        },
      },
    });
    if (!event) throw new NotFoundException('Evento de contingencia no encontrado');
    return event;
  }

  async close(id: string, dto: CloseContingencyDto, ctx: AuditContext) {
    const event = await this.findOne(id);
    if (event.status !== ContingencyStatus.ABIERTA) {
      throw new BadRequestException('Solo se puede cerrar un evento ABIERTO');
    }
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : new Date();
    if (endedAt < event.startedAt) {
      throw new BadRequestException('La fecha de fin no puede ser anterior al inicio');
    }

    const updated = await this.prisma.contingencyEvent.update({
      where: { id },
      data: { status: ContingencyStatus.CERRADA, endedAt },
    });
    await this.audit.log(
      'CONTINGENCY_CLOSE',
      'tax_contingency_events',
      id,
      { status: event.status },
      { status: updated.status, endedAt },
      ctx,
    );
    return {
      event: updated,
      note:
        'Cierre local simulado. La normativa verificada menciona el registro del evento dentro de las 48 horas posteriores; ' +
        'la comunicación real al SIN no está implementada.',
    };
  }

  async report(id: string, dto: ReportContingencyDto, ctx: AuditContext) {
    const event = await this.findOne(id);
    if (event.status !== ContingencyStatus.CERRADA) {
      throw new BadRequestException('Solo se puede regularizar un evento CERRADO');
    }

    const updated = await this.prisma.contingencyEvent.update({
      where: { id },
      data: {
        status: ContingencyStatus.REGULARIZADA,
        reportedAt: new Date(),
        eventCode: dto.eventCode ?? `SIM-EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
      },
    });
    await this.audit.log(
      'CONTINGENCY_REPORT',
      'tax_contingency_events',
      id,
      { status: event.status },
      { status: updated.status, reportedAt: updated.reportedAt, eventCode: updated.eventCode },
      ctx,
    );
    return {
      event: updated,
      note:
        'Regularización simulada. No se envió información real al SIN ni se creó un paquete oficial.',
    };
  }

  async attachInvoice(eventId: string, invoiceId: string, ctx: AuditContext) {
    const event = await this.findOne(eventId);
    if (event.status !== ContingencyStatus.ABIERTA) {
      throw new BadRequestException('Solo se pueden asociar facturas a un evento ABIERTO');
    }
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (invoice.issuerId !== event.issuerId) {
      throw new BadRequestException('La factura pertenece a otro emisor');
    }
    if (invoice.status === InvoiceStatus.AUTORIZADA || invoice.status === InvoiceStatus.ANULADA) {
      throw new BadRequestException('No se puede asociar una factura ya autorizada o anulada');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.invoice.update({
        where: { id: invoiceId },
        data: { contingencyId: eventId, status: InvoiceStatus.EN_CONTINGENCIA },
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId,
          type: 'ASOCIACION_CONTINGENCIA',
          fromStatus: invoice.status,
          toStatus: InvoiceStatus.EN_CONTINGENCIA,
          actorId: ctx.actorId,
          correlationId: ctx.correlationId,
          message: `Factura asociada al evento de contingencia ${eventId}`,
        },
      });
      return changed;
    });

    await this.audit.log(
      'CONTINGENCY_ATTACH_INVOICE',
      'tax_invoices',
      invoiceId,
      { contingencyId: invoice.contingencyId, status: invoice.status },
      { contingencyId: eventId, status: updated.status },
      ctx,
    );
    return updated;
  }
}
