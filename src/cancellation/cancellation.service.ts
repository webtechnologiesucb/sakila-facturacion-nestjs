import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CancellationStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import { InvoicesService } from '../invoices/invoices.service';
import { TaxAuthorityService } from '../tax-authority/tax-authority.service';
import { assertTransition } from '../invoices/invoice-state.machine';
import { CreateCancellationDto } from './dto/cancellation.dto';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly taxAuthority: TaxAuthorityService,
  ) {}

  async request(
    invoiceId: string,
    requestedBy: string,
    dto: CreateCancellationDto,
    ctx: AuditContext,
  ) {
    const invoice = await this.invoices.findOne(invoiceId);
    if (invoice.status !== InvoiceStatus.AUTORIZADA) {
      throw new BadRequestException(
        'Solo se puede solicitar la anulación de una factura AUTORIZADA',
      );
    }
    if (!invoice.cuf) throw new BadRequestException('La factura no tiene CUF');

    const pending = await this.prisma.cancellationRequest.findFirst({
      where: { invoiceId, status: CancellationStatus.PENDIENTE },
    });
    if (pending) {
      throw new ConflictException('Ya existe una solicitud de anulación pendiente');
    }

    assertTransition(invoice.status, InvoiceStatus.PENDIENTE_DE_ANULACION);

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cancellationRequest.create({
        data: {
          invoiceId,
          reason: dto.reason,
          requestedBy,
          status: CancellationStatus.PENDIENTE,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.PENDIENTE_DE_ANULACION,
          taxStatus: 'PENDIENTE_DE_ANULACION',
        },
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId,
          type: 'SOLICITUD_ANULACION',
          fromStatus: InvoiceStatus.AUTORIZADA,
          toStatus: InvoiceStatus.PENDIENTE_DE_ANULACION,
          actorId: requestedBy,
          correlationId: ctx.correlationId,
          message: 'Solicitud de anulación registrada',
          payload: { cancellationRequestId: created.id, reason: dto.reason },
        },
      });
      return created;
    });

    try {
      const result = await this.taxAuthority.cancelInvoice({
        invoiceId,
        cuf: invoice.cuf,
        reason: dto.reason,
        issuer: invoice.issuer,
        configuration: invoice.configuration,
        pointOfSaleCode: invoice.pointOfSale.code,
        correlationId: ctx.correlationId,
      });

      const nextStatus = result.approved
        ? InvoiceStatus.ANULADA
        : InvoiceStatus.AUTORIZADA;

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.cancellationRequest.update({
          where: { id: request.id },
          data: {
            status: result.approved
              ? CancellationStatus.APROBADA
              : CancellationStatus.RECHAZADA,
            resolvedAt: new Date(),
            responseCode: result.code,
            responseMessage: result.message,
          },
        });
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: nextStatus,
            taxStatus: nextStatus,
          },
        });
        await tx.invoiceEvent.create({
          data: {
            invoiceId,
            type: result.approved ? 'ANULACION' : 'ANULACION_RECHAZADA',
            fromStatus: InvoiceStatus.PENDIENTE_DE_ANULACION,
            toStatus: nextStatus,
            actorId: requestedBy,
            correlationId: ctx.correlationId,
            message: result.message,
            payload: { code: result.code, simulated: result.simulated },
          },
        });
        return tx.cancellationRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: { invoice: { select: { id: true, publicId: true, status: true } } },
        });
      });

      await this.audit.log(
        result.approved ? 'INVOICE_CANCELLED' : 'INVOICE_CANCELLATION_REJECTED',
        'tax_cancellation_requests',
        request.id,
        { status: CancellationStatus.PENDIENTE },
        { status: updated.status, invoiceStatus: nextStatus },
        ctx,
      );

      return { request: updated, result };
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.cancellationRequest.update({
          where: { id: request.id },
          data: {
            status: CancellationStatus.RECHAZADA,
            resolvedAt: new Date(),
            responseCode: 'ERROR_DE_COMUNICACION',
            responseMessage: (error as Error).message,
          },
        }),
        this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.AUTORIZADA, taxStatus: 'AUTORIZADA' },
        }),
        this.prisma.invoiceEvent.create({
          data: {
            invoiceId,
            type: 'ERROR_ANULACION',
            fromStatus: InvoiceStatus.PENDIENTE_DE_ANULACION,
            toStatus: InvoiceStatus.AUTORIZADA,
            actorId: requestedBy,
            correlationId: ctx.correlationId,
            message: (error as Error).message,
          },
        }),
      ]);
      this.logger.warn(`Fallo al anular factura ${invoiceId}`);
      throw error;
    }
  }

  async reverse(
    cancellationId: string,
    requestedBy: string,
    reason: string,
    ctx: AuditContext,
  ) {
    const cancellation = await this.prisma.cancellationRequest.findUnique({
      where: { id: cancellationId },
      include: { invoice: true },
    });
    if (!cancellation) throw new NotFoundException('Solicitud de anulación no encontrada');
    if (cancellation.status !== CancellationStatus.APROBADA) {
      throw new BadRequestException('Solo se puede revertir una anulación APROBADA');
    }
    if (cancellation.invoice.status !== InvoiceStatus.ANULADA) {
      throw new BadRequestException('La factura no está ANULADA');
    }
    assertTransition(cancellation.invoice.status, InvoiceStatus.AUTORIZADA);

    const invoice = await this.invoices.findOne(cancellation.invoiceId);
    const cuf = invoice.cuf;
    if (!cuf) throw new BadRequestException('La factura no tiene CUF');

    const result = await this.taxAuthority.revertCancellation({
      invoiceId: invoice.id,
      cuf,
      reason,
      issuer: invoice.issuer,
      configuration: invoice.configuration,
      pointOfSaleCode: invoice.pointOfSale.code,
      correlationId: ctx.correlationId,
    });

    if (!result.approved) {
      await this.audit.log(
        'INVOICE_REVERSION_REJECTED',
        'tax_cancellation_requests',
        cancellationId,
        { status: cancellation.status },
        { code: result.code, message: result.message },
        ctx,
      );
      return { reversal: null, result };
    }

    const reversal = await this.prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: cancellationId },
        data: { status: CancellationStatus.REVERTIDA, resolvedAt: new Date() },
      });
      const created = await tx.cancellationRequest.create({
        data: {
          invoiceId: invoice.id,
          reason,
          status: CancellationStatus.REVERTIDA,
          requestedBy,
          resolvedAt: new Date(),
          responseCode: result.code,
          responseMessage: result.message,
          reversalOfId: cancellationId,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.AUTORIZADA, taxStatus: 'AUTORIZADA' },
      });
      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: 'REVERSION_ANULACION',
          fromStatus: InvoiceStatus.ANULADA,
          toStatus: InvoiceStatus.AUTORIZADA,
          actorId: requestedBy,
          correlationId: ctx.correlationId,
          message: result.message,
          payload: { reversalId: created.id, originalCancellationId: cancellationId },
        },
      });
      return created;
    });

    await this.audit.log(
      'INVOICE_REVERSION',
      'tax_cancellation_requests',
      cancellationId,
      { status: CancellationStatus.APROBADA },
      { status: CancellationStatus.REVERTIDA, reversalId: reversal.id },
      ctx,
    );

    return { reversal, result };
  }

  async list(invoiceId?: string) {
    const where: Prisma.CancellationRequestWhereInput = invoiceId ? { invoiceId } : {};
    return this.prisma.cancellationRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      include: {
        invoice: { select: { id: true, publicId: true, status: true, total: true } },
        reversals: { select: { id: true, status: true, requestedAt: true } },
      },
    });
  }
}
