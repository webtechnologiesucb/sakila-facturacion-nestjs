import { INVOICE_TRANSITIONS, assertTransition, canTransition } from './invoice-state.machine';
import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

describe('máquina de estados de facturas', () => {
  it('permite el flujo feliz de emisión', () => {
    expect(canTransition(InvoiceStatus.BORRADOR, InvoiceStatus.PENDIENTE_DE_VALIDACION)).toBe(true);
    expect(
      canTransition(InvoiceStatus.PENDIENTE_DE_VALIDACION, InvoiceStatus.PENDIENTE_DE_ENVIO),
    ).toBe(true);
    expect(
      canTransition(InvoiceStatus.PENDIENTE_DE_ENVIO, InvoiceStatus.EN_PROCESAMIENTO),
    ).toBe(true);
    expect(canTransition(InvoiceStatus.EN_PROCESAMIENTO, InvoiceStatus.AUTORIZADA)).toBe(true);
    expect(canTransition(InvoiceStatus.AUTORIZADA, InvoiceStatus.PENDIENTE_DE_ANULACION)).toBe(true);
    expect(canTransition(InvoiceStatus.PENDIENTE_DE_ANULACION, InvoiceStatus.ANULADA)).toBe(true);
  });

  it('no permite saltar de borrador a autorizada', () => {
    expect(() =>
      assertTransition(InvoiceStatus.BORRADOR, InvoiceStatus.AUTORIZADA),
    ).toThrow(BadRequestException);
  });

  it('no permite modificar una factura anulada salvo reversión controlada', () => {
    expect(canTransition(InvoiceStatus.ANULADA, InvoiceStatus.AUTORIZADA)).toBe(true);
    expect(() =>
      assertTransition(InvoiceStatus.ANULADA, InvoiceStatus.PENDIENTE_DE_ENVIO),
    ).toThrow(BadRequestException);
  });

  it('permite reenviar desde contingencia', () => {
    expect(
      canTransition(InvoiceStatus.EN_CONTINGENCIA, InvoiceStatus.PENDIENTE_DE_ENVIO),
    ).toBe(true);
  });
});
