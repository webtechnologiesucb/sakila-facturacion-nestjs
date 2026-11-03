import { XMLValidator } from 'fast-xml-parser';
import { XmlGenerationService } from './xml-generation.service';

const data = {
  publicId: 'INV-20260101-ABCD1234',
  documentType: 'FACTURA',
  documentSector: '1',
  serie: 'A',
  number: 1,
  cuf: 'SIM-CUF-XYZ',
  cufd: 'SIM-CUFD-XYZ',
  cuis: 'SIM-CUIS-XYZ',
  controlCode: 'SIM-CTRL-XYZ',
  issueDate: new Date('2026-01-01T12:00:00.000Z'),
  currency: 'BOB',
  exchangeRate: '1.000000',
  issuer: {
    nit: '1234567890',
    legalName: 'Emisor & Demo <SRL>',
    businessName: 'Emisor Demo',
    economicActivityCode: '620100',
    address: 'Av. Demo 123',
    phone: '+59170000000',
    email: 'emisor@demo.local',
  },
  branch: {
    code: 'SUC-01',
    name: 'Sucursal Central',
    address: 'Av. Demo 123',
    municipality: 'La Paz',
  },
  pointOfSale: { code: 'PV-01', name: 'Caja 1' },
  customer: {
    documentType: 'NIT',
    documentNumber: '9876543210',
    businessName: 'Cliente "Demo"',
    email: 'cliente@demo.local',
    phone: '+59171111111',
    address: 'Calle 1',
  },
  items: [
    {
      lineNumber: 1,
      description: 'Producto <especial> & único',
      productCode: 'SRV-001',
      unitOfMeasure: 'UNIDAD',
      quantity: '2.0000',
      unitPrice: '100.0000',
      discount: '0.00',
      lineSubtotal: '200.00',
      taxRate: '0.130000',
      taxAmount: '26.00',
      lineTotal: '226.00',
    },
  ],
  subtotal: '200.00',
  discountTotal: '0.00',
  taxableBase: '200.00',
  taxTotal: '26.00',
  total: '226.00',
  simulated: true,
  modality: 'ELECTRONICA_EN_LINEA',
  environment: 'SIMULATED',
};

describe('XmlGenerationService', () => {
  const service = new XmlGenerationService();

  it('genera un XML bien formado con perfil simulado', () => {
    const result = service.generate(data);
    expect(XMLValidator.validate(result.xml)).toBe(true);
    expect(result.xml).toContain('facturaSimulada');
    expect(result.xml).toContain('NO ES UN XML OFICIAL DEL SIN');
    expect(result.profileId).toBe('SAKILA-SIMULATED-FACTURA-V1');
    expect(result.simulated).toBe(true);
    expect(result.xsdValidated).toBe(false);
  });

  it('escapa caracteres peligrosos en los datos', () => {
    const result = service.generate(data);
    expect(result.xml).toContain('Emisor &amp; Demo &lt;SRL&gt;');
    expect(result.xml).toContain('Producto &lt;especial&gt; &amp; único');
    expect(result.xml).not.toContain('<SRL>');
  });

  it('genera un hash SHA-256 de 64 caracteres', () => {
    const result = service.generate(data);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rechaza generar XML sin líneas', () => {
    expect(() => service.generate({ ...data, items: [] })).toThrow();
  });
});
