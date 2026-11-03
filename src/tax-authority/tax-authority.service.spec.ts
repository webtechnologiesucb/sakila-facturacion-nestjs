import { ServiceUnavailableException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { TaxAuthorityService } from './tax-authority.service';
import { SiatTransientError, TaxAuthorityProvider } from './tax-authority.types';

function buildService(
  provider: Partial<TaxAuthorityProvider>,
  options: { retries?: number; timeoutMs?: number } = {},
) {
  const prisma = {
    siatRequest: { create: jest.fn().mockResolvedValue({}) },
  };
  const config = {
    get: (key: string) => {
      if (key === 'SIAT_TIMEOUT_MS') return String(options.timeoutMs ?? 1000);
      if (key === 'SIAT_RETRIES') return String(options.retries ?? 2);
      return undefined;
    },
  };
  const service = new TaxAuthorityService(
    provider as TaxAuthorityProvider,
    prisma as any,
    config as any,
    {} as any,
  );
  return { service, prisma };
}

const params = {
  invoiceId: '00000000-0000-0000-0000-000000000001',
  publicId: 'INV-1',
  cuf: 'SIM-CUF-1',
  issueDate: new Date(),
  documentType: DocumentType.FACTURA,
  total: '100.00',
  customerDocumentNumber: '123',
  customerBusinessName: 'Cliente',
  xml: '<x/>',
  xmlHash: 'a'.repeat(64),
  issuer: { id: 'i', nit: '1', legalName: 'Emisor' } as any,
  configuration: {
    environment: 'SIMULATED',
    modality: 'ELECTRONICA_EN_LINEA',
  } as any,
  pointOfSaleCode: 'PV-01',
};

describe('TaxAuthorityService', () => {
  it('reintenta errores transitorios hasta obtener éxito', async () => {
    const submitInvoice = jest
      .fn()
      .mockRejectedValueOnce(new SiatTransientError('fallo 1'))
      .mockRejectedValueOnce(new SiatTransientError('fallo 2'))
      .mockResolvedValueOnce({
        success: true,
        code: 'OK',
        message: 'ok',
        simulated: true,
      });
    const { service } = buildService({ submitInvoice }, { retries: 2 });
    const result = await service.submitInvoice(params);
    expect(result.success).toBe(true);
    expect(result.attempt).toBe(3);
    expect(submitInvoice).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un rechazo funcional', async () => {
    const submitInvoice = jest.fn().mockResolvedValue({
      success: false,
      code: 'MOCK-RECHAZO',
      message: 'rechazo',
      simulated: true,
    });
    const { service } = buildService({ submitInvoice }, { retries: 2 });
    const result = await service.submitInvoice(params);
    expect(result.success).toBe(false);
    expect(result.attempt).toBe(1);
    expect(submitInvoice).toHaveBeenCalledTimes(1);
  });

  it('convierte un timeout en un error HTTP controlado', async () => {
    const submitInvoice = jest.fn().mockImplementation(() => new Promise(() => undefined));
    const { service } = buildService({ submitInvoice }, { retries: 0, timeoutMs: 30 });
    await expect(service.submitInvoice(params)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
