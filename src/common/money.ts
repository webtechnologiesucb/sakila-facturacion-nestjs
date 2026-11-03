import Decimal from 'decimal.js';

// Configuración decimal explícita para cálculos fiscales.
// Se usa ROUND_HALF_UP a 2 decimales como valor por defecto CONFIGURABLE.
// La regla oficial de redondeo del SIN está PENDIENTE de verificación documental.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type RoundingMode =
  | 'ROUND_UP'
  | 'ROUND_DOWN'
  | 'ROUND_HALF_UP'
  | 'ROUND_HALF_EVEN';

const roundingMap: Record<RoundingMode, Decimal.Rounding> = {
  ROUND_UP: Decimal.ROUND_UP,
  ROUND_DOWN: Decimal.ROUND_DOWN,
  ROUND_HALF_UP: Decimal.ROUND_HALF_UP,
  ROUND_HALF_EVEN: Decimal.ROUND_HALF_EVEN,
};

export function decimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: Decimal, mode: RoundingMode = 'ROUND_HALF_UP'): Decimal {
  return value.toDecimalPlaces(2, roundingMap[mode]);
}

export function moneyToString(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}

export function taxRateToString(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(6);
}

export function sumMoney(values: Array<Decimal | string | number>): Decimal {
  return values.reduce<Decimal>((acc, value) => acc.plus(value), new Decimal(0));
}
