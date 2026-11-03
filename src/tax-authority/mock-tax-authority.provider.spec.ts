import { TaxEnvironment, TaxModality, DocumentType } from '@prisma/client';
import {
  MockTaxAuthorityProvider,
} from './mock-tax-authority.provider';
import {
  InvoiceSubmissionRequest,
  SiatTransientError,
  TaxAuthorityContext,
} from './tax-authority.types';

const context: TaxAuthorityContext = {
  issuerId: '00000000-0000-0000-0000-000000000001',
  nit: '1234567890',
  legalName: 'Emisor Demo',
  environment: TaxEnvironment.SIMULATED,
  modality: TaxModality.ELECTRONICA_EN_LINEA,
  pointOfSaleCode: 'PV-01',
};

function submission(overrides: Partial<InvoiceSubmissionRequest> = {}): InvoiceSubmissionRequest {
  return {
    invoiceId: '00000000-0000-0000-0000-000000000010',
    publicId: 'INV-TEST',
    cuf: 'SIM-CUF-TEST',
    issueDate: new Date().toISOString(),
    documentType: DocumentType.FACTURA,
    total: '226.00',
    customerDocumentNumber: '9876543210',
    customerBusinessName: 'Cliente Demo',
    xml: '<facturaSimulada/>',
    xmlHash: 'a'.repeat(64),
    context,
    ...overrides,
  };
}

describe('MockTaxAuthorityProvider', () => {
  it('genera CUFD determinista para el mismo día y contexto', async () => {
    const provider = new MockTaxAuthorityProvider();
    const first = await provider.requestCufd({ context });
    const second = await provider.requestCufd({ context });
    expect(first.cufd).toBe(second.cufd);
    expect(first.simulated).toBe(true);
    expect(new Date(first.validUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('autoriza de forma determinista en el modo por defecto', async () => {
    const provider = new MockTaxAuthorityProvider({ outcome: 'success' });
    const first = await provider.submitInvoice(submission());
    const second = await provider.submitInvoice(submission());
    expect(first.success).toBe(true);
    expect(first.authorizationCode).toBe(second.authorizationCode);
    expect(first.simulated).toBe(true);
  });

  it('rechaza facturas con total cero o negativo', async () => {
    const provider = new MockTaxAuthorityProvider({ outcome: 'success' });
    const result = await provider.submitInvoice(submission({ total: '0' }));
    expect(result.success).toBe(false);
    expect(result.code).toBe('MOCK-RECHAZO');
  });

  it('permite simular un rechazo explícito', async () => {
    const provider = new MockTaxAuthorityProvider({ outcome: 'rejection' });
    const result = await provider.submitInvoice(submission());
    expect(result.success).toBe(false);
    expect(result.code).toBe('MOCK-RECHAZO');
  });

  it('permite simular un fallo transitorio para probar reintentos', async () => {
    const provider = new MockTaxAuthorityProvider({ outcome: 'failure' });
    await expect(provider.submitInvoice(submission())).rejects.toBeInstanceOf(
      SiatTransientError,
    );
  });

  it('permite simular timeout', async () => {
    const provider = new MockTaxAuthorityProvider({ outcome: 'timeout' });
    await expect(provider.submitInvoice(submission())).rejects.toBeInstanceOf(
      SiatTransientError,
    );
  });

  it('no expone endpoints reales ni códigos de autorización oficiales', async () => {
    const provider = new MockTaxAuthorityProvider();
    const status = await provider.checkCommunication(context);
    expect(status.simulated).toBe(true);
    expect(status.message).toContain('simulada');
  });
});
