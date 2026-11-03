import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ContingencyStatus,
  DocumentType,
  InvoiceStatus,
  Prisma,
  SignatureStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import { TaxConfigurationService } from '../tax-configuration/tax-configuration.service';
import { TaxCalculationService } from '../tax-calculation/tax-calculation.service';
import { TaxAuthorityService } from '../tax-authority/tax-authority.service';
import { XmlGenerationService } from '../xml-generation/xml-generation.service';
import { DigitalSignatureService } from '../digital-signature/digital-signature.service';
import { CreateInvoiceDto, InvoiceQueryDto } from './dto/invoice.dto';
import {
  assertTransition,
  IMMUTABLE_STATES,
} from './invoice-state.machine';

const invoiceInclude = {
  issuer: true,
  branch: true,
  pointOfSale: true,
  configuration: true,
  customer: true,
  contingency: true,
  items: { orderBy: { lineNumber: 'asc' as const } },
  document: true,
  events: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

const invoiceListInclude = {
  issuer: { select: { id: true, nit: true, legalName: true } },
  branch: { select: { id: true, code: true, name: true } },
  pointOfSale: { select: { id: true, code: true, name: true } },
  customer: { select: { id: true, businessName: true, documentNumber: true } },
  items: { select: { lineNumber: true, description: true, lineTotal: true } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly taxConfiguration: TaxConfigurationService,
    private readonly taxCalculation: TaxCalculationService,
    private readonly taxAuthority: TaxAuthorityService,
    private readonly xmlGeneration: XmlGenerationService,
    private readonly signature: DigitalSignatureService,
  ) {}

  // --------------------------------------------------------------------------
  // Creación (borrador)
  // --------------------------------------------------------------------------

  async create(dto: CreateInvoiceDto, ctx: AuditContext, headerIdempotencyKey?: string) {
    const idempotencyKey = this.resolveIdempotencyKey(dto.idempotencyKey, headerIdempotencyKey);

    const existing = await this.prisma.invoice.findUnique({
      where: { idempotencyKey },
      include: invoiceInclude,
    });
    if (existing) {
      return { invoice: existing, idempotent: true };
    }

    const [
      issuer,
      branch,
      pointOfSale,
      customer,
      configuration,
      contingency,
      originalInvoice,
    ] = await Promise.all([
      this.prisma.issuer.findUnique({ where: { id: dto.issuerId } }),
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
      this.prisma.pointOfSale.findUnique({ where: { id: dto.pointOfSaleId } }),
      this.prisma.customer.findUnique({ where: { id: dto.customerId } }),
      dto.configurationId
        ? this.prisma.taxConfiguration.findUnique({ where: { id: dto.configurationId } })
        : this.taxConfiguration.getEffectiveConfiguration(dto.issuerId),
      dto.contingencyId
        ? this.prisma.contingencyEvent.findUnique({ where: { id: dto.contingencyId } })
        : Promise.resolve(null),
      dto.originalInvoiceId
        ? this.prisma.invoice.findUnique({ where: { id: dto.originalInvoiceId } })
        : Promise.resolve(null),
    ]);

    if (!issuer) throw new BadRequestException('El emisor indicado no existe');
    if (!issuer.active) throw new BadRequestException('El emisor está inactivo');
    if (!branch) throw new BadRequestException('La sucursal indicada no existe');
    if (branch.issuerId !== issuer.id) {
      throw new BadRequestException('La sucursal no pertenece al emisor indicado');
    }
    if (!pointOfSale) throw new BadRequestException('El punto de venta indicado no existe');
    if (pointOfSale.branchId !== branch.id) {
      throw new BadRequestException('El punto de venta no pertenece a la sucursal indicada');
    }
    if (!customer) throw new BadRequestException('El cliente indicado no existe');
    if (!customer.active) throw new BadRequestException('El cliente está inactivo');

    if (!configuration) {
      throw new BadRequestException('No existe una configuración tributaria disponible');
    }
    if (configuration.issuerId !== issuer.id) {
      throw new BadRequestException('La configuración no pertenece al emisor indicado');
    }
    if (!configuration.active) {
      throw new BadRequestException('La configuración tributaria está inactiva');
    }
    const now = new Date();
    if (configuration.effectiveFrom > now) {
      throw new BadRequestException('La configuración tributaria aún no está vigente');
    }
    if (configuration.effectiveTo && configuration.effectiveTo <= now) {
      throw new BadRequestException('La configuración tributaria está vencida');
    }

    if (contingency) {
      if (contingency.issuerId !== issuer.id) {
        throw new BadRequestException('El evento de contingencia no pertenece al emisor');
      }
      if (contingency.status !== ContingencyStatus.ABIERTA) {
        throw new BadRequestException('El evento de contingencia no está abierto');
      }
    }

    const documentType = dto.documentType ?? DocumentType.FACTURA;
    if (documentType !== DocumentType.FACTURA) {
      if (!originalInvoice) {
        throw new BadRequestException('Las notas de crédito/débito requieren una factura original');
      }
      if (originalInvoice.status !== InvoiceStatus.AUTORIZADA) {
        throw new BadRequestException('La factura original debe estar AUTORIZADA');
      }
      if (originalInvoice.customerId !== customer.id) {
        throw new BadRequestException('La factura original pertenece a otro cliente');
      }
      if (originalInvoice.issuerId !== issuer.id) {
        throw new BadRequestException('La factura original pertenece a otro emisor');
      }
    }

    const productIds = dto.items
      .map((item) => item.productId)
      .filter((value): value is string => Boolean(value));
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } } })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    const calculationLines = dto.items.map((item, index) => {
      const product = item.productId ? productMap.get(item.productId) : undefined;
      if (item.productId && !product) {
        throw new BadRequestException(`El producto de la línea ${index + 1} no existe`);
      }
      if (product && !product.active) {
        throw new BadRequestException(`El producto de la línea ${index + 1} está inactivo`);
      }

      const description = item.description ?? product?.name;
      const unitPrice = item.unitPrice ?? product?.unitPrice;
      const unitOfMeasure = item.unitOfMeasure ?? product?.unitOfMeasure;
      if (!description) {
        throw new BadRequestException(`La línea ${index + 1} requiere descripción`);
      }
      if (unitPrice === undefined) {
        throw new BadRequestException(`La línea ${index + 1} requiere precio unitario`);
      }
      if (!unitOfMeasure) {
        throw new BadRequestException(`La línea ${index + 1} requiere unidad de medida`);
      }

      const taxRate = item.taxRate ?? product?.taxRate ?? configuration.defaultTaxRate;
      return {
        input: {
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          discount: (item.discount ?? 0).toString(),
          taxRate: taxRate.toString(),
          priceIncludesTax: product?.taxIncluded ?? configuration.priceIncludesTax,
        },
        productId: product?.id,
        description,
        productCode: item.productCode ?? product?.sku,
        unitOfMeasure,
      };
    });

    const calculation = this.taxCalculation.calculate(
      calculationLines.map((line) => line.input),
      {
        roundingMode: configuration.roundingMode as any,
        priceIncludesTax: configuration.priceIncludesTax,
      },
    );

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    if (Number.isNaN(issueDate.getTime())) {
      throw new BadRequestException('Fecha de emisión inválida');
    }

    const customerSnapshot = {
      id: customer.id,
      documentType: customer.documentType,
      documentNumber: customer.documentNumber,
      businessName: customer.businessName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      taxpayerType: customer.taxpayerType,
    };

    const publicId = `INV-${issueDate.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    try {
      const invoice = await this.prisma.$transaction(async (tx) => {
        const number = await this.reserveNumber(tx, {
          issuerId: issuer.id,
          branchId: branch.id,
          pointOfSaleId: pointOfSale.id,
          documentType,
          serie: dto.serie.toUpperCase(),
        });

        const created = await tx.invoice.create({
          data: {
            publicId,
            idempotencyKey,
            issuerId: issuer.id,
            branchId: branch.id,
            pointOfSaleId: pointOfSale.id,
            configurationId: configuration.id,
            customerId: customer.id,
            customerSnapshot,
            contingencyId: contingency?.id ?? null,
            documentType,
            modality: configuration.modality,
            documentSector: '1',
            serie: dto.serie.toUpperCase(),
            number,
            issueDate,
            currency: dto.currency ?? configuration.currency,
            exchangeRate: new Decimal(dto.exchangeRate ?? 1).toFixed(6),
            subtotal: calculation.subtotal,
            discountTotal: calculation.discountTotal,
            taxableBase: calculation.taxableBase,
            taxTotal: calculation.taxTotal,
            total: calculation.total,
            status: contingency ? InvoiceStatus.EN_CONTINGENCIA : InvoiceStatus.BORRADOR,
            originalInvoiceId: originalInvoice?.id ?? null,
            simulated: true,
            items: {
              create: calculation.lines.map((line, index) => ({
                productId: calculationLines[index].productId,
                lineNumber: index + 1,
                description: calculationLines[index].description,
                productCode: calculationLines[index].productCode,
                unitOfMeasure: calculationLines[index].unitOfMeasure,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount,
                lineSubtotal: line.lineSubtotal,
                taxRate: line.taxRate,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
              })),
            },
          },
          include: invoiceInclude,
        });

        await tx.invoiceEvent.create({
          data: {
            invoiceId: created.id,
            type: 'CREACION',
            toStatus: created.status,
            actorId: ctx.actorId,
            correlationId: ctx.correlationId,
            message: contingency
              ? 'Factura creada dentro de un evento de contingencia'
              : 'Factura creada en estado borrador',
          },
        });

        return created;
      });

      await this.audit.log(
        'INVOICE_CREATE',
        'tax_invoices',
        invoice.id,
        null,
        {
          publicId: invoice.publicId,
          number: invoice.number,
          serie: invoice.serie,
          total: invoice.total.toString(),
          status: invoice.status,
        },
        ctx,
      );

      return { invoice, idempotent: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String((error.meta as any)?.target ?? '');
        if (target.includes('idempotency_key')) {
          const duplicate = await this.prisma.invoice.findUnique({
            where: { idempotencyKey },
            include: invoiceInclude,
          });
          if (duplicate) return { invoice: duplicate, idempotent: true };
        }
        throw new ConflictException(
          'Ya existe una factura con esa serie y número para el punto de venta',
        );
      }
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Emisión: CUF, XML y firma simulada
  // --------------------------------------------------------------------------

  async emit(id: string, ctx: AuditContext) {
    const invoice = await this.findOne(id);

    if (invoice.frozenAt || invoice.document) {
      return { invoice, idempotent: true, signature: null };
    }
    assertTransition(invoice.status, InvoiceStatus.PENDIENTE_DE_VALIDACION);

    const cufd = await this.taxAuthority.requestCufd(invoice.issuerId, invoice.pointOfSaleId);
    const cuf = this.buildCuf(invoice, cufd.result.cufd);
    const controlCode = this.buildControlCode(invoice, cuf);

    const xmlData = {
      publicId: invoice.publicId,
      documentType: invoice.documentType,
      documentSector: invoice.documentSector,
      serie: invoice.serie,
      number: invoice.number,
      cuf,
      cufd: cufd.result.cufd,
      cuis: cufd.result.cuis,
      controlCode,
      issueDate: invoice.issueDate,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate.toString(),
      issuer: {
        nit: invoice.issuer.nit,
        legalName: invoice.issuer.legalName,
        businessName: invoice.issuer.businessName,
        economicActivityCode: invoice.issuer.economicActivityCode,
        address: invoice.issuer.address,
        phone: invoice.issuer.phone,
        email: invoice.issuer.email,
      },
      branch: {
        code: invoice.branch.code,
        name: invoice.branch.name,
        address: invoice.branch.address,
        municipality: invoice.branch.municipality,
      },
      pointOfSale: { code: invoice.pointOfSale.code, name: invoice.pointOfSale.name },
      customer: {
        documentType: invoice.customer.documentType,
        documentNumber: invoice.customer.documentNumber,
        businessName: invoice.customer.businessName,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
      },
      items: invoice.items.map((item) => ({
        lineNumber: item.lineNumber,
        description: item.description,
        productCode: item.productCode,
        unitOfMeasure: item.unitOfMeasure,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        discount: item.discount.toString(),
        lineSubtotal: item.lineSubtotal.toString(),
        taxRate: item.taxRate.toString(),
        taxAmount: item.taxAmount.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
      subtotal: invoice.subtotal.toString(),
      discountTotal: invoice.discountTotal.toString(),
      taxableBase: invoice.taxableBase.toString(),
      taxTotal: invoice.taxTotal.toString(),
      total: invoice.total.toString(),
      simulated: true,
      modality: invoice.modality,
      environment: invoice.configuration.environment,
    };

    const generated = this.xmlGeneration.generate(xmlData);
    const signed = await this.signature.sign(generated.xml);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: 'VALIDACION',
          fromStatus: invoice.status,
          toStatus: InvoiceStatus.PENDIENTE_DE_VALIDACION,
          actorId: ctx.actorId,
          correlationId: ctx.correlationId,
          message: 'Cálculo y datos validados para emisión simulada',
        },
      });

      const next = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          cuf,
          cufd: cufd.result.cufd,
          cuis: cufd.result.cuis,
          controlCode,
          documentHash: signed.xmlHash,
          status: InvoiceStatus.PENDIENTE_DE_ENVIO,
          frozenAt: new Date(),
          taxStatus: 'PENDIENTE_DE_ENVIO',
        },
      });

      await tx.invoiceDocument.create({
        data: {
          invoiceId: invoice.id,
          profileId: generated.profileId,
          xml: signed.xml,
          xmlHash: signed.xmlHash,
          xsdVersion: generated.xsdVersion,
          xsdValidated: generated.xsdValidated,
          signatureStatus:
            signed.status === 'FIRMADA_SIMULADA'
              ? SignatureStatus.FIRMADA_SIMULADA
              : SignatureStatus.FIRMADA,
          signedAt: new Date(signed.signedAt),
          signatureProvider: signed.provider,
        },
      });

      await tx.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: 'EMISION',
          fromStatus: InvoiceStatus.PENDIENTE_DE_VALIDACION,
          toStatus: InvoiceStatus.PENDIENTE_DE_ENVIO,
          actorId: ctx.actorId,
          correlationId: ctx.correlationId,
          message: 'Documento congelado, XML simulado generado y firma simulada aplicada',
          payload: {
            cuf,
            cufd: cufd.result.cufd,
            xmlHash: signed.xmlHash,
            profileId: generated.profileId,
          },
        },
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: next.id },
        include: invoiceInclude,
      });
    });

    await this.audit.log(
      'INVOICE_EMIT',
      'tax_invoices',
      invoice.id,
      { status: invoice.status },
      { status: updated.status, cuf, xmlHash: signed.xmlHash },
      ctx,
    );

    return { invoice: updated, idempotent: false, signature: signed };
  }

  // --------------------------------------------------------------------------
  // Envío al proveedor tributario
  // --------------------------------------------------------------------------

  async send(id: string, ctx: AuditContext) {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.AUTORIZADA) {
      return {
        invoice,
        idempotent: true,
        result: {
          success: true,
          code: 'YA_AUTORIZADA',
          message: 'La factura ya estaba autorizada; no se reenvió',
          receptionCode: invoice.receptionCode ?? undefined,
          authorizationCode: invoice.authorizationCode ?? undefined,
          simulated: invoice.simulated,
        },
      };
    }
    if (!invoice.document || !invoice.cuf) {
      throw new BadRequestException('La factura debe emitirse antes de enviarse');
    }
    if (invoice.status === InvoiceStatus.RECHAZADA) {
      throw new BadRequestException('Una factura rechazada no puede reenviarse; genere una corrección');
    }
    assertTransition(invoice.status, InvoiceStatus.EN_PROCESAMIENTO);

    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.EN_PROCESAMIENTO, taxStatus: 'EN_PROCESAMIENTO' },
      }),
      this.prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          type: 'ENVIO_INICIADO',
          fromStatus: invoice.status,
          toStatus: InvoiceStatus.EN_PROCESAMIENTO,
          actorId: ctx.actorId,
          correlationId: ctx.correlationId,
          message: 'Envío al proveedor tributario',
        },
      }),
    ]);

    try {
      const result = await this.taxAuthority.submitInvoice({
        invoiceId: invoice.id,
        publicId: invoice.publicId,
        cuf: invoice.cuf,
        issueDate: invoice.issueDate,
        documentType: invoice.documentType,
        total: invoice.total.toString(),
        customerDocumentNumber: invoice.customer.documentNumber,
        customerBusinessName: invoice.customer.businessName,
        xml: invoice.document.xml,
        xmlHash: invoice.document.xmlHash,
        issuer: invoice.issuer,
        configuration: invoice.configuration,
        pointOfSaleCode: invoice.pointOfSale.code,
        correlationId: ctx.correlationId,
        idempotencyKey: invoice.idempotencyKey,
      });

      const nextStatus = result.success
        ? InvoiceStatus.AUTORIZADA
        : InvoiceStatus.RECHAZADA;

      const updated = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: nextStatus,
            taxStatus: nextStatus,
            receptionCode: result.receptionCode,
            authorizationCode: result.authorizationCode,
          },
        });
        await tx.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            type: result.success ? 'AUTORIZACION' : 'RECHAZO',
            fromStatus: InvoiceStatus.EN_PROCESAMIENTO,
            toStatus: nextStatus,
            actorId: ctx.actorId,
            correlationId: ctx.correlationId,
            message: result.message,
            payload: {
              code: result.code,
              receptionCode: result.receptionCode,
              authorizationCode: result.authorizationCode,
              attempt: result.attempt,
              simulated: result.simulated,
            },
          },
        });
        return tx.invoice.findUniqueOrThrow({
          where: { id: changed.id },
          include: invoiceInclude,
        });
      });

      await this.audit.log(
        result.success ? 'INVOICE_AUTHORIZED' : 'INVOICE_REJECTED',
        'tax_invoices',
        invoice.id,
        { status: InvoiceStatus.EN_PROCESAMIENTO },
        { status: nextStatus, code: result.code, attempt: result.attempt },
        ctx,
      );

      return { invoice: updated, idempotent: false, result };
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PENDIENTE_DE_ENVIO, taxStatus: 'ERROR_DE_ENVIO' },
        }),
        this.prisma.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            type: 'ERROR_DE_ENVIO',
            fromStatus: InvoiceStatus.EN_PROCESAMIENTO,
            toStatus: InvoiceStatus.PENDIENTE_DE_ENVIO,
            actorId: ctx.actorId,
            correlationId: ctx.correlationId,
            message: (error as Error).message,
          },
        }),
      ]);
      this.logger.warn(`Fallo de envío de factura ${invoice.id}`);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Consultas
  // --------------------------------------------------------------------------

  async list(query: InvoiceQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.issuerId ? { issuerId: query.issuerId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? {
            issueDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: invoiceListInclude,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    return invoice;
  }

  async getXml(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { document: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada');
    if (!invoice.document) {
      throw new NotFoundException('La factura aún no tiene XML generado');
    }
    return {
      invoiceId: invoice.id,
      publicId: invoice.publicId,
      cuf: invoice.cuf,
      profileId: invoice.document.profileId,
      xml: invoice.document.xml,
      hash: invoice.document.xmlHash,
      signatureStatus: invoice.document.signatureStatus,
      signatureProvider: invoice.document.signatureProvider,
      signedAt: invoice.document.signedAt,
      xsdValidated: invoice.document.xsdValidated,
      simulated: true,
      disclaimer:
        'XML simulado sin validez tributaria. No fue validado contra un XSD oficial ni firmado con XMLDSig.',
    };
  }

  assertImmutable(invoice: { status: InvoiceStatus; frozenAt: Date | null }): void {
    if (invoice.frozenAt || IMMUTABLE_STATES.includes(invoice.status)) {
      throw new ConflictException('El documento emitido es inmutable');
    }
  }

  // --------------------------------------------------------------------------
  // Utilidades internas
  // --------------------------------------------------------------------------

  private resolveIdempotencyKey(
    bodyKey: string | undefined,
    headerKey: string | undefined,
  ): string {
    const key = (headerKey && headerKey.trim()) || bodyKey?.trim();
    if (!key) return randomUUID();
    if (key.length < 8 || key.length > 120) {
      throw new BadRequestException('Idempotency-Key debe tener entre 8 y 120 caracteres');
    }
    return key;
  }

  private async reserveNumber(
    tx: Prisma.TransactionClient,
    params: {
      issuerId: string;
      branchId: string;
      pointOfSaleId: string;
      documentType: DocumentType;
      serie: string;
    },
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ number: number }>>`
      INSERT INTO "tax_invoice_sequences"
        ("id", "issuer_id", "branch_id", "point_of_sale_id", "document_type", "serie", "next_number", "version", "updated_at")
      VALUES
        (gen_random_uuid(), ${params.issuerId}::uuid, ${params.branchId}::uuid, ${params.pointOfSaleId}::uuid, ${params.documentType}::"DocumentType", ${params.serie}, 2, 1, now())
      ON CONFLICT ("issuer_id", "branch_id", "point_of_sale_id", "document_type", "serie")
      DO UPDATE SET
        "next_number" = "tax_invoice_sequences"."next_number" + 1,
        "version" = "tax_invoice_sequences"."version" + 1,
        "updated_at" = now()
      RETURNING "next_number" - 1 AS "number"
    `;
    const number = rows[0]?.number;
    if (typeof number !== 'number' || number < 1) {
      throw new ConflictException('No se pudo reservar un número de factura');
    }
    return number;
  }

  private buildCuf(invoice: InvoiceWithRelations, cufd: string): string {
    const payload = [
      invoice.issuer.nit,
      invoice.branch.code,
      invoice.pointOfSale.code,
      invoice.documentType,
      invoice.serie,
      invoice.number,
      invoice.issueDate.toISOString(),
      invoice.total.toString(),
      cufd,
    ].join('|');
    return `SIM-CUF-${createHash('sha256').update(payload).digest('hex').slice(0, 40)}`;
  }

  private buildControlCode(invoice: InvoiceWithRelations, cuf: string): string {
    const payload = [cuf, invoice.customer.documentNumber, invoice.total.toString()].join('|');
    return `SIM-CTRL-${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`;
  }
}
