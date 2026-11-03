import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { moneyToString, RoundingMode, roundMoney } from '../common/money';

export interface TaxCalculationLineInput {
  /** Cantidad vendida. Debe ser mayor que cero. */
  quantity: string | number;
  /** Precio unitario antes de descuento. */
  unitPrice: string | number;
  /** Descuento de línea sobre el precio por cantidad. */
  discount?: string | number;
  /** Tasa expresada como fracción, por ejemplo 0.13 para 13 %. */
  taxRate: string | number;
  /** Si el precio unitario ya incluye el impuesto. */
  priceIncludesTax?: boolean;
}

export interface TaxCalculationOptions {
  roundingMode?: RoundingMode;
  /** Valor por defecto cuando la línea no define priceIncludesTax. */
  priceIncludesTax?: boolean;
}

export interface TaxCalculationLineResult {
  quantity: string;
  unitPrice: string;
  discount: string;
  /** Importe bruto de la línea antes de descuento. */
  lineSubtotal: string;
  /** Base imponible de la línea. */
  taxableBase: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

export interface TaxCalculationResult {
  lines: TaxCalculationLineResult[];
  subtotal: string;
  discountTotal: string;
  taxableBase: string;
  taxTotal: string;
  total: string;
  roundingMode: RoundingMode;
}

/**
 * Motor de cálculo tributario puro y determinista.
 *
 * IMPORTANTE: las reglas de redondeo y la forma de expresar precios con/sin
 * impuesto son configurables. La regla oficial del SIN está PENDIENTE de
 * verificación documental (ver docs/NORMATIVA.md).
 */
@Injectable()
export class TaxCalculationService {
  calculate(
    lines: TaxCalculationLineInput[],
    options: TaxCalculationOptions = {},
  ): TaxCalculationResult {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('La factura debe tener al menos una línea');
    }

    const roundingMode = options.roundingMode ?? 'ROUND_HALF_UP';
    const validModes: RoundingMode[] = [
      'ROUND_UP',
      'ROUND_DOWN',
      'ROUND_HALF_UP',
      'ROUND_HALF_EVEN',
    ];
    if (!validModes.includes(roundingMode)) {
      throw new BadRequestException(`Modo de redondeo no soportado: ${roundingMode}`);
    }

    const results: TaxCalculationLineResult[] = [];
    let subtotal = new Decimal(0);
    let discountTotal = new Decimal(0);
    let taxableBase = new Decimal(0);
    let taxTotal = new Decimal(0);
    let total = new Decimal(0);

    lines.forEach((line, index) => {
      const position = index + 1;
      const quantity = this.parseDecimal(line.quantity, `cantidad de línea ${position}`);
      const unitPrice = this.parseDecimal(line.unitPrice, `precio unitario de línea ${position}`);
      const discount = this.parseDecimal(line.discount ?? 0, `descuento de línea ${position}`);
      const rate = this.parseDecimal(line.taxRate, `tasa de línea ${position}`);

      if (quantity.lessThanOrEqualTo(0)) {
        throw new BadRequestException(`La cantidad de la línea ${position} debe ser mayor que cero`);
      }
      if (unitPrice.lessThan(0)) {
        throw new BadRequestException(`El precio unitario de la línea ${position} no puede ser negativo`);
      }
      if (discount.lessThan(0)) {
        throw new BadRequestException(`El descuento de la línea ${position} no puede ser negativo`);
      }
      if (rate.lessThan(0) || rate.greaterThan(1)) {
        throw new BadRequestException(`La tasa de la línea ${position} debe estar entre 0 y 1`);
      }

      const gross = roundMoney(quantity.times(unitPrice), roundingMode);
      const roundedDiscount = roundMoney(discount, roundingMode);
      if (roundedDiscount.greaterThan(gross)) {
        throw new BadRequestException(
          `El descuento de la línea ${position} supera el importe bruto`,
        );
      }

      const net = gross.minus(roundedDiscount);
      const includesTax = line.priceIncludesTax ?? options.priceIncludesTax ?? false;

      let lineTaxableBase: Decimal;
      let lineTax: Decimal;
      let lineTotal: Decimal;

      if (includesTax) {
        lineTaxableBase = roundMoney(net.dividedBy(new Decimal(1).plus(rate)), roundingMode);
        lineTax = roundMoney(net.minus(lineTaxableBase), roundingMode);
        lineTotal = roundMoney(net, roundingMode);
      } else {
        lineTaxableBase = roundMoney(net, roundingMode);
        lineTax = roundMoney(lineTaxableBase.times(rate), roundingMode);
        lineTotal = roundMoney(lineTaxableBase.plus(lineTax), roundingMode);
      }

      results.push({
        quantity: quantity.toFixed(4),
        unitPrice: unitPrice.toFixed(4),
        discount: moneyToString(roundedDiscount),
        lineSubtotal: moneyToString(gross),
        taxableBase: moneyToString(lineTaxableBase),
        taxRate: rate.toFixed(6),
        taxAmount: moneyToString(lineTax),
        lineTotal: moneyToString(lineTotal),
      });

      subtotal = subtotal.plus(gross);
      discountTotal = discountTotal.plus(roundedDiscount);
      taxableBase = taxableBase.plus(lineTaxableBase);
      taxTotal = taxTotal.plus(lineTax);
      total = total.plus(lineTotal);
    });

    return {
      lines: results,
      subtotal: moneyToString(roundMoney(subtotal, roundingMode)),
      discountTotal: moneyToString(roundMoney(discountTotal, roundingMode)),
      taxableBase: moneyToString(roundMoney(taxableBase, roundingMode)),
      taxTotal: moneyToString(roundMoney(taxTotal, roundingMode)),
      total: moneyToString(roundMoney(total, roundingMode)),
      roundingMode,
    };
  }

  private parseDecimal(value: string | number, field: string): Decimal {
    try {
      const parsed = new Decimal(value);
      if (!parsed.isFinite()) throw new Error('not finite');
      return parsed;
    } catch {
      throw new BadRequestException(`Valor decimal inválido en ${field}`);
    }
  }
}
