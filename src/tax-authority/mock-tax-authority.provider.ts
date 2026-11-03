import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  CufdRequest,
  CufdResult,
  InvoiceCancellationRequest,
  InvoiceCancellationResult,
  InvoiceReversionRequest,
  InvoiceReversionResult,
  InvoiceStatusRequest,
  InvoiceStatusResult,
  InvoiceSubmissionRequest,
  InvoiceSubmissionResult,
  SiatTransientError,
  TaxAuthorityCommunicationResult,
  TaxAuthorityContext,
  TaxAuthorityProvider,
} from './tax-authority.types';

export type MockOutcome = 'success' | 'rejection' | 'failure' | 'timeout';

export interface MockTaxAuthorityOptions {
  outcome?: MockOutcome;
  cufdValidityHours?: number;
}

/**
 * Proveedor simulado determinista.
 *
 * No llama al SIN ni inventa endpoints oficiales. Las respuestas se derivan
 * del hash de los datos de entrada para que las pruebas sean reproducibles.
 * El código 926 se usa solo como eco del método verificarComunicacion
 * documentado públicamente; NO implica autorización real.
 */
@Injectable()
export class MockTaxAuthorityProvider implements TaxAuthorityProvider {
  readonly name = 'mock-deterministic';
  readonly simulated = true;
  private readonly logger = new Logger(MockTaxAuthorityProvider.name);
  private readonly outcome: MockOutcome;
  private readonly cufdValidityHours: number;

  constructor(options: MockTaxAuthorityOptions = {}) {
    this.outcome = options.outcome ?? (process.env.MOCK_SIAT_OUTCOME as MockOutcome) ?? 'success';
    this.cufdValidityHours = options.cufdValidityHours ?? 24;
  }

  async checkCommunication(
    _context: TaxAuthorityContext,
  ): Promise<TaxAuthorityCommunicationResult> {
    return {
      online: true,
      code: '926',
      message: 'Comunicación simulada correcta (no es una respuesta real del SIN)',
      simulated: true,
      checkedAt: new Date().toISOString(),
    };
  }

  async requestCufd(request: CufdRequest): Promise<CufdResult> {
    const { context } = request;
    const day = new Date().toISOString().slice(0, 10);
    const seed = `${context.nit}|${context.environment}|${context.modality}|${context.pointOfSaleCode ?? ''}|${day}`;
    const digest = this.digest(seed);
    return {
      cufd: `SIM-CUFD-${digest.slice(0, 40)}`,
      cuis: `SIM-CUIS-${this.digest(`cuis|${seed}`).slice(0, 32)}`,
      controlCode: `SIM-CTRL-${this.digest(`ctrl|${seed}`).slice(0, 24)}`,
      validUntil: new Date(Date.now() + this.cufdValidityHours * 3600 * 1000).toISOString(),
      code: 'MOCK-CUFD-OK',
      message: 'CUFD simulado. No válido ante el SIN.',
      simulated: true,
    };
  }

  async submitInvoice(request: InvoiceSubmissionRequest): Promise<InvoiceSubmissionResult> {
    if (this.outcome === 'timeout') {
      throw new SiatTransientError('Tiempo de espera simulado del proveedor tributario');
    }
    if (this.outcome === 'failure') {
      throw new SiatTransientError('Fallo transitorio simulado del proveedor tributario');
    }

    const invalidReasons: string[] = [];
    if (Number(request.total) <= 0) invalidReasons.push('El total debe ser mayor que cero');
    if (!request.cuf) invalidReasons.push('Falta CUF');
    if (!request.customerDocumentNumber) invalidReasons.push('Falta documento del comprador');

    if (this.outcome === 'rejection' || invalidReasons.length > 0) {
      return {
        success: false,
        code: 'MOCK-RECHAZO',
        message:
          invalidReasons.length > 0
            ? `Rechazo simulado: ${invalidReasons.join('; ')}`
            : 'Rechazo simulado solicitado por configuración',
        simulated: true,
        state: 'RECHAZADA',
      };
    }

    const digest = this.digest(`${request.cuf}|${request.xmlHash}|${request.invoiceId}`);
    return {
      success: true,
      code: 'MOCK-AUTORIZADA',
      message: 'Autorización simulada. No tiene validez tributaria real.',
      receptionCode: `SIM-REC-${digest.slice(0, 20)}`,
      authorizationCode: `SIM-AUT-${digest.slice(0, 32)}`,
      state: 'AUTORIZADA',
      simulated: true,
    };
  }

  async queryInvoiceStatus(request: InvoiceStatusRequest): Promise<InvoiceStatusResult> {
    return {
      found: true,
      code: 'MOCK-CONSULTA',
      message: 'Consulta simulada de estado',
      state: 'AUTORIZADA',
      authorizationCode: `SIM-AUT-${this.digest(`status|${request.cuf}`).slice(0, 32)}`,
      simulated: true,
    };
  }

  async cancelInvoice(request: InvoiceCancellationRequest): Promise<InvoiceCancellationResult> {
    if (this.outcome === 'rejection') {
      return {
        approved: false,
        code: 'MOCK-ANULACION-RECHAZADA',
        message: 'Anulación simulada rechazada por configuración',
        simulated: true,
      };
    }
    return {
      approved: true,
      code: 'MOCK-ANULACION-APROBADA',
      message: 'Anulación simulada aprobada. No tiene validez tributaria real.',
      simulated: true,
    };
  }

  async revertCancellation(
    request: InvoiceReversionRequest,
  ): Promise<InvoiceReversionResult> {
    this.logger.debug(`Reversión simulada para factura ${request.invoiceId}`);
    return {
      approved: true,
      code: 'MOCK-REVERSION-APROBADA',
      message: 'Reversión de anulación simulada aprobada.',
      simulated: true,
    };
  }

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
