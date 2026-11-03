import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import Decimal from 'decimal.js';

export interface DecimalValueOptions {
  min?: string | number;
  max?: string | number;
  decimalPlaces?: number;
  allowNegative?: boolean;
}

/**
 * Valida valores decimales recibidos como string o número sin perder precisión.
 * Se usa en importes y tasas para evitar conversiones a float.
 */
export function IsDecimalValue(
  options: DecimalValueOptions = {},
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDecimalValue',
      target: object.constructor,
      propertyName,
      constraints: [options],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined || value === '') return false;
          let parsed: Decimal;
          try {
            parsed = new Decimal(value as Decimal.Value);
          } catch {
            return false;
          }
          if (!parsed.isFinite()) return false;
          if (!options.allowNegative && parsed.isNegative()) return false;
          if (options.min !== undefined && parsed.lessThan(options.min)) return false;
          if (options.max !== undefined && parsed.greaterThan(options.max)) return false;
          if (
            options.decimalPlaces !== undefined &&
            parsed.decimalPlaces() > options.decimalPlaces
          ) {
            return false;
          }
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          const messages = [`${args.property} debe ser un valor decimal válido`];
          if (options.min !== undefined) messages.push(`mínimo ${options.min}`);
          if (options.max !== undefined) messages.push(`máximo ${options.max}`);
          if (options.decimalPlaces !== undefined) {
            messages.push(`máximo ${options.decimalPlaces} decimales`);
          }
          return messages.join(', ');
        },
      },
    });
  };
}
