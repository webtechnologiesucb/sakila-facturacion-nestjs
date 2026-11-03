import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, Issuer, TaxConfiguration } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TaxConfigurationService } from '../tax-configuration/tax-configuration.service';
import {
  InvoiceSubmissionResult,
  SiatTransientError,
  TAX_AUTHORITY_PROVIDER,
  TaxAuthorityContext,
  TaxAuthorityProvider,
} from './tax-authority.types';

export interface SubmitInvoiceParams {
  invoiceId: string;
  publicId: string;
  cuf: string;
  issueDate: Date;
  documentType: DocumentType;
  total: string;
  customerDocumentNumber: string;
  customerBusinessName: string;
  xml: string;
  xmlHash: string;
  issuer: Issuer;
  configuration: TaxConfiguration;
  pointOfSaleCode?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface SubmitInvoiceResponse extends InvoiceSubmissionResult {
  attempt: number;
  durationMs: number;
}

@Injectable()
export class TaxAuthorityService {
  private readonly logger = new Logger(TaxAuthorityService.name);
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(
    @Inject(TAX_AUTHORITY_PROVIDER)
    private readonly provider: TaxAuthorityProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly taxConfiguration: TaxConfigurationService,
  ) {
    this.timeoutMs = Math.max(500, Number(this.configService.get('SIAT_TIMEOUT_MS') || 8000));
    this.retries = Math.max(0, Number(this.configService.get('SIAT_RETRIES') || 2));
  }

  providerInfo() {
    return {
      name: this.provider.name,
      simulated: this.provider.simulated,
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      disclaimer: this.provider.simulated
        ? 'Proveedor simulado determinista. No válido ante el SIN.'
        : 'Proveedor real bloqueado hasta verificar contratos oficiales.',
    };
  }

  async contextFor(issuerId: string, pointOfSaleId?: string): Promise<TaxAuthorityContext> {
    const issuer = await this.prisma.issuer.findUnique({ where: { id: issuerId } });
    if (!issuer) throw new NotFoundException('Emisor no encontrado');
    const configuration = await this.taxConfiguration.getEffectiveConfiguration(issuerId);

    let pointOfSaleCode: string | undefined;
    if (pointOfSaleId) {
      const pointOfSale = await this.prisma.pointOfSale.findUnique({
        where: { id: pointOfSaleId },
      });
      if (!pointOfSale) throw new NotFoundException('Punto de venta no encontrado');
      pointOfSaleCode = pointOfSale.code;
    }

    return {
      issuerId: issuer.id,
      nit: issuer.nit,
      legalName: issuer.legalName,
      environment: configuration.environment,
      modality: configuration.modality,
      pointOfSaleCode,
    };
  }

  async status(issuerId: string, pointOfSaleId?: string) {
    const context = await this.contextFor(issuerId, pointOfSaleId);
    try {
      const result = await this.withTimeout(
        this.provider.checkCommunication(context),
        'verificarComunicacion',
      );
      return { provider: this.providerInfo(), context, result };
    } catch (error) {
      return {
        provider: this.providerInfo(),
        context,
        result: {
          online: false,
          code: 'ERROR',
          message: (error as Error).message,
          simulated: this.provider.simulated,
          checkedAt: new Date().toISOString(),
        },
      };
    }
  }

  async requestCufd(issuerId: string, pointOfSaleId?: string) {
    const context = await this.contextFor(issuerId, pointOfSaleId);
    const started = Date.now();
    try {
      const result = await this.withTimeout(
        this.provider.requestCufd({ context }),
        'solicitudCufd',
      );
      await this.record({
        operation: 'solicitudCufd',
        success: true,
        requestPayload: { issuerId, environment: context.environment },
        responsePayload: { code: result.code, validUntil: result.validUntil },
        durationMs: Date.now() - started,
      });
      return { provider: this.providerInfo(), context, result };
    } catch (error) {
      await this.record({
        operation: 'solicitudCufd',
        success: false,
        requestPayload: { issuerId, environment: context.environment },
        errorCode: 'CUFD_ERROR',
        message: (error as Error).message,
        durationMs: Date.now() - started,
      });
      throw this.toHttpError(error);
    }
  }

  async submitInvoice(params: SubmitInvoiceParams): Promise<SubmitInvoiceResponse> {
    if (!params.cuf) throw new BadRequestException('La factura no tiene CUF generado');

    const context: TaxAuthorityContext = {
      issuerId: params.issuer.id,
      nit: params.issuer.nit,
      legalName: params.issuer.legalName,
      environment: params.configuration.environment,
      modality: params.configuration.modality,
      pointOfSaleCode: params.pointOfSaleCode,
    };
    const correlationId = params.correlationId ?? randomUUID();
    const maxAttempts = this.retries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now();
      try {
        const result = await this.withTimeout(
          this.provider.submitInvoice({
            invoiceId: params.invoiceId,
            publicId: params.publicId,
            cuf: params.cuf,
            issueDate: params.issueDate.toISOString(),
            documentType: params.documentType,
            total: params.total,
            customerDocumentNumber: params.customerDocumentNumber,
            customerBusinessName: params.customerBusinessName,
            xml: params.xml,
            xmlHash: params.xmlHash,
            context,
          }),
          'recepcionFactura',
        );
        const durationMs = Date.now() - started;
        await this.record({
          invoiceId: params.invoiceId,
          operation: 'recepcionFactura',
          correlationId,
          idempotencyKey: params.idempotencyKey,
          success: result.success,
          requestPayload: { cuf: params.cuf, total: params.total },
          responsePayload: { ...result },
          errorCode: result.success ? undefined : result.code,
          message: result.message,
          attempt,
          durationMs,
        });
        return { ...result, attempt, durationMs };
      } catch (error) {
        lastError = error;
        const durationMs = Date.now() - started;
        await this.record({
          invoiceId: params.invoiceId,
          operation: 'recepcionFactura',
          correlationId,
          idempotencyKey: params.idempotencyKey,
          success: false,
          requestPayload: { cuf: params.cuf, total: params.total },
          errorCode: error instanceof SiatTransientError ? 'TRANSIENT' : 'ERROR',
          message: (error as Error).message,
          attempt,
          durationMs,
        });
        if (!(error instanceof SiatTransientError) || attempt >= maxAttempts) {
          break;
        }
        this.logger.warn(
          `Reintento ${attempt}/${this.retries} de recepción de factura ${params.invoiceId}`,
        );
      }
    }

    throw this.toHttpError(lastError);
  }

  async cancelInvoice(params: {
    invoiceId: string;
    cuf: string;
    reason: string;
    issuer: Issuer;
    configuration: TaxConfiguration;
    pointOfSaleCode?: string;
    correlationId?: string;
  }) {
    const context: TaxAuthorityContext = {
      issuerId: params.issuer.id,
      nit: params.issuer.nit,
      legalName: params.issuer.legalName,
      environment: params.configuration.environment,
      modality: params.configuration.modality,
      pointOfSaleCode: params.pointOfSaleCode,
    };
    const correlationId = params.correlationId ?? randomUUID();
    const started = Date.now();
    try {
      const result = await this.withTimeout(
        this.provider.cancelInvoice({
          invoiceId: params.invoiceId,
          cuf: params.cuf,
          reason: params.reason,
          context,
        }),
        'anulacionFactura',
      );
      await this.record({
        invoiceId: params.invoiceId,
        operation: 'anulacionFactura',
        correlationId,
        success: result.approved,
        requestPayload: { cuf: params.cuf, reason: params.reason.slice(0, 300) },
        responsePayload: { ...result },
        errorCode: result.approved ? undefined : result.code,
        message: result.message,
        durationMs: Date.now() - started,
      });
      return result;
    } catch (error) {
      await this.record({
        invoiceId: params.invoiceId,
        operation: 'anulacionFactura',
        correlationId,
        success: false,
        requestPayload: { cuf: params.cuf },
        errorCode: 'ERROR',
        message: (error as Error).message,
        durationMs: Date.now() - started,
      });
      throw this.toHttpError(error);
    }
  }

  async revertCancellation(params: {
    invoiceId: string;
    cuf: string;
    reason: string;
    issuer: Issuer;
    configuration: TaxConfiguration;
    pointOfSaleCode?: string;
    correlationId?: string;
  }) {
    const context: TaxAuthorityContext = {
      issuerId: params.issuer.id,
      nit: params.issuer.nit,
      legalName: params.issuer.legalName,
      environment: params.configuration.environment,
      modality: params.configuration.modality,
      pointOfSaleCode: params.pointOfSaleCode,
    };
    const correlationId = params.correlationId ?? randomUUID();
    const started = Date.now();
    try {
      const result = await this.withTimeout(
        this.provider.revertCancellation({
          invoiceId: params.invoiceId,
          cuf: params.cuf,
          reason: params.reason,
          context,
        }),
        'reversionAnulacionFactura',
      );
      await this.record({
        invoiceId: params.invoiceId,
        operation: 'reversionAnulacionFactura',
        correlationId,
        success: result.approved,
        requestPayload: { cuf: params.cuf },
        responsePayload: { ...result },
        errorCode: result.approved ? undefined : result.code,
        message: result.message,
        durationMs: Date.now() - started,
      });
      return result;
    } catch (error) {
      await this.record({
        invoiceId: params.invoiceId,
        operation: 'reversionAnulacionFactura',
        correlationId,
        success: false,
        requestPayload: { cuf: params.cuf },
        errorCode: 'ERROR',
        message: (error as Error).message,
        durationMs: Date.now() - started,
      });
      throw this.toHttpError(error);
    }
  }

  private async record(params: {
    invoiceId?: string;
    operation: string;
    correlationId?: string;
    idempotencyKey?: string;
    success: boolean;
    requestPayload?: unknown;
    responsePayload?: unknown;
    errorCode?: string;
    message?: string;
    attempt?: number;
    durationMs?: number;
  }): Promise<void> {
    try {
      await this.prisma.siatRequest.create({
        data: {
          invoiceId: params.invoiceId ?? null,
          operation: params.operation,
          correlationId: params.correlationId ?? randomUUID(),
          idempotencyKey: params.idempotencyKey,
          requestPayload: params.requestPayload as any,
          responsePayload: params.responsePayload as any,
          success: params.success,
          errorCode: params.errorCode,
          message: params.message?.slice(0, 2000),
          attempt: params.attempt ?? 1,
          durationMs: params.durationMs,
        },
      });
    } catch (error) {
      this.logger.error(`No se pudo registrar la solicitud SIAT ${params.operation}`);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new SiatTransientError(`Tiempo de espera agotado en ${operation}`));
          }, this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof ServiceUnavailableException) return error as unknown as Error;
    return new ServiceUnavailableException(
      `No fue posible completar la operación tributaria: ${(error as Error)?.message ?? 'error desconocido'}`,
    );
  }
}
