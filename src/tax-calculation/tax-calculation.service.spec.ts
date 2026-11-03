import { BadRequestException } from '@nestjs/common';
import { TaxCalculationService } from './tax-calculation.service';

describe('TaxCalculationService', () => {
  const service = new TaxCalculationService();

  it('calcula una línea con impuesto agregado', () => {
    const result = service.calculate([{ quantity: '2', unitPrice: '100', taxRate: '0.13' }]);
    expect(result.subtotal).toBe('200.00');
    expect(result.discountTotal).toBe('0.00');
    expect(result.taxableBase).toBe('200.00');
    expect(result.taxTotal).toBe('26.00');
    expect(result.total).toBe('226.00');
  });

  it('calcula una línea con impuesto incluido en el precio', () => {
    const result = service.calculate(
      [{ quantity: '1', unitPrice: '113', taxRate: '0.13', priceIncludesTax: true }],
      { priceIncludesTax: true },
    );
    expect(result.taxableBase).toBe('100.00');
    expect(result.taxTotal).toBe('13.00');
    expect(result.total).toBe('113.00');
  });

  it('aplica descuentos antes del impuesto', () => {
    const result = service.calculate([
      { quantity: '1', unitPrice: '100', discount: '10', taxRate: '0.13' },
    ]);
    expect(result.subtotal).toBe('100.00');
    expect(result.discountTotal).toBe('10.00');
    expect(result.taxableBase).toBe('90.00');
    expect(result.taxTotal).toBe('11.70');
    expect(result.total).toBe('101.70');
  });

  it('suma varias líneas y conserva dos decimales', () => {
    const result = service.calculate([
      { quantity: '3', unitPrice: '10.555', taxRate: '0.13' },
      { quantity: '1', unitPrice: '0.005', taxRate: '0' },
    ]);
    expect(result.lines).toHaveLength(2);
    expect(result.subtotal).toBe('31.68');
    expect(result.total).toBe('35.80');
  });

  it('redondea con ROUND_HALF_UP de forma explícita', () => {
    const result = service.calculate(
      [{ quantity: '1', unitPrice: '10.005', taxRate: '0' }],
      { roundingMode: 'ROUND_HALF_UP' },
    );
    expect(result.total).toBe('10.01');
  });

  it('rechaza cantidades no positivas', () => {
    expect(() => service.calculate([{ quantity: '0', unitPrice: '10', taxRate: '0.13' }])).toThrow(
      BadRequestException,
    );
  });

  it('rechaza tasas fuera de rango', () => {
    expect(() => service.calculate([{ quantity: '1', unitPrice: '10', taxRate: '1.5' }])).toThrow(
      BadRequestException,
    );
  });

  it('rechaza descuentos mayores al importe bruto', () => {
    expect(() =>
      service.calculate([{ quantity: '1', unitPrice: '10', discount: '11', taxRate: '0.13' }]),
    ).toThrow(BadRequestException);
  });

  it('rechaza listas vacías', () => {
    expect(() => service.calculate([])).toThrow(BadRequestException);
  });
});
