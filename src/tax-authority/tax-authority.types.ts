import { TaxEnvironment, TaxModality, DocumentType } from '@prisma/client';

export const TAX_AUTHORITY_PROVIDER = Symbol('TAX_AUTHORITY_PROVIDER');

export interface TaxAuthorityContext {
  issuerId: string;
  nit: string;
  legalName: string;
  environment: TaxEnvironment;
  modality: TaxModality;
  pointOfSaleCode?: string;
}

export interface TaxAuthorityCommunicationResult {
  online: boolean;
  code: string;
  message: string;
  simulated: boolean;
  checkedAt: string;
}

export interface CufdRequest {
  context: TaxAuthorityContext;
}

export interface CufdResult {
  cufd: string;
  cuis: string;
  controlCode: string;
  validUntil: string;
  code: string;
  message: string;
  simulated: boolean;
}

export interface InvoiceSubmissionRequest {
  invoiceId: string;
  publicId: string;
  cuf: string;
  issueDate: string;
  documentType: DocumentType;
  total: string;
  customerDocumentNumber: string;
  customerBusinessName: string;
  xml: string;
  xmlHash: string;
  context: TaxAuthorityContext;
}

export interface InvoiceSubmissionResult {
  success: boolean;
  code: string;
  message: string;
  receptionCode?: string;
  authorizationCode?: string;
  state?: string;
  simulated: boolean;
}

export interface InvoiceStatusRequest {
  cuf: string;
  context: TaxAuthorityContext;
}

export interface InvoiceStatusResult {
  found: boolean;
  code: string;
  message: string;
  state?: string;
  authorizationCode?: string;
  simulated: boolean;
}

export interface InvoiceCancellationRequest {
  invoiceId: string;
  cuf: string;
  reason: string;
  context: TaxAuthorityContext;
}

export interface InvoiceCancellationResult {
  approved: boolean;
  code: string;
  message: string;
  simulated: boolean;
}

export interface InvoiceReversionRequest {
  invoiceId: string;
  cuf: string;
  reason: string;
  context: TaxAuthorityContext;
}

export interface InvoiceReversionResult {
  approved: boolean;
  code: string;
  message: string;
  simulated: boolean;
}

/**
 * Contrato interno de integración tributaria.
 * No representa un WSDL oficial: es una abstracción propia.
 */
export interface TaxAuthorityProvider {
  readonly name: string;
  readonly simulated: boolean;
  checkCommunication(context: TaxAuthorityContext): Promise<TaxAuthorityCommunicationResult>;
  requestCufd(request: CufdRequest): Promise<CufdResult>;
  submitInvoice(request: InvoiceSubmissionRequest): Promise<InvoiceSubmissionResult>;
  queryInvoiceStatus(request: InvoiceStatusRequest): Promise<InvoiceStatusResult>;
  cancelInvoice(request: InvoiceCancellationRequest): Promise<InvoiceCancellationResult>;
  revertCancellation(
    request: InvoiceReversionRequest,
  ): Promise<InvoiceReversionResult>;
}

export class SiatTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiatTransientError';
  }
}
