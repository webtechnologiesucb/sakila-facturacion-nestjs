import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  TaxAuthorityCommunicationResult,
  TaxAuthorityContext,
  TaxAuthorityProvider,
} from './tax-authority.types';

/**
 * Adaptador real deliberadamente bloqueado.
 *
 * No se implementan endpoints, WSDL ni estructuras XML inventadas. Para
 * habilitarlo se requiere:
 *   1. Contratos oficiales (WSDL/XSD) verificados y versionados.
 *   2. Credenciales y certificado digital válidos.
 *   3. SIAT_CONTRACTS_VERIFIED=true y SIAT_MODE=real.
 *
 * Mientras falte cualquiera de esos requisitos, todas las operaciones fallan
 * de forma explícita en lugar de simular una integración oficial.
 */
@Injectable()
export class SiatTaxAuthorityProvider implements TaxAuthorityProvider {
  readonly name = 'siat-real-bloqueado';
  readonly simulated = false;
  private readonly logger = new Logger(SiatTaxAuthorityProvider.name);

  constructor(private readonly config: ConfigService) {}

  private assertReady(): never {
    const missing = ['SIAT_BASE_URL', 'SIAT_CLIENT_ID', 'SIAT_CLIENT_SECRET'].filter(
      (key) => !this.config.get<string>(key),
    );
    if (missing.length > 0 || this.config.get('SIAT_CONTRACTS_VERIFIED') !== 'true') {
      this.logger.error('Adaptador SIAT real invocado sin configuración verificada');
      throw new ServiceUnavailableException(
        'El adaptador SIAT real no está habilitado. Faltan contratos oficiales verificados o credenciales. ' +
          'Use SIAT_MODE=simulated para el prototipo.',
      );
    }
    throw new ServiceUnavailableException(
      'La integración SIAT real está deliberadamente no implementada: los contratos oficiales ' +
        '(WSDL/XSD) no fueron verificados en este repositorio. No se inventan endpoints ni estructuras.',
    );
  }

  async checkCommunication(
    _context: TaxAuthorityContext,
  ): Promise<TaxAuthorityCommunicationResult> {
    this.assertReady();
  }

  async requestCufd(_request: CufdRequest): Promise<CufdResult> {
    this.assertReady();
  }

  async submitInvoice(_request: InvoiceSubmissionRequest): Promise<InvoiceSubmissionResult> {
    this.assertReady();
  }

  async queryInvoiceStatus(
    _request: InvoiceStatusRequest,
  ): Promise<InvoiceStatusResult> {
    this.assertReady();
  }

  async cancelInvoice(
    _request: InvoiceCancellationRequest,
  ): Promise<InvoiceCancellationResult> {
    this.assertReady();
  }

  async revertCancellation(
    _request: InvoiceReversionRequest,
  ): Promise<InvoiceReversionResult> {
    this.assertReady();
  }
}
