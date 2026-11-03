import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

/**
 * Máquina de estados interna del documento fiscal.
 * Los nombres son propios y deben mapearse a los estados oficiales de la
 * modalidad cuando se verifique la normativa (ver docs/NORMATIVA.md).
 */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  BORRADOR: [InvoiceStatus.PENDIENTE_DE_VALIDACION, InvoiceStatus.EN_CONTINGENCIA],
  PENDIENTE_DE_VALIDACION: [
    InvoiceStatus.PENDIENTE_DE_ENVIO,
    InvoiceStatus.RECHAZADA,
  ],
  PENDIENTE_DE_ENVIO: [
    InvoiceStatus.EN_PROCESAMIENTO,
    InvoiceStatus.EN_CONTINGENCIA,
  ],
  EN_PROCESAMIENTO: [
    InvoiceStatus.AUTORIZADA,
    InvoiceStatus.RECHAZADA,
    InvoiceStatus.PENDIENTE_DE_ENVIO,
  ],
  AUTORIZADA: [InvoiceStatus.PENDIENTE_DE_ANULACION],
  RECHAZADA: [],
  PENDIENTE_DE_ANULACION: [InvoiceStatus.ANULADA, InvoiceStatus.AUTORIZADA],
  // La reversión de anulación es una transición controlada y auditada.
  ANULADA: [InvoiceStatus.AUTORIZADA],
  EN_CONTINGENCIA: [
    InvoiceStatus.PENDIENTE_DE_VALIDACION,
    InvoiceStatus.PENDIENTE_DE_ENVIO,
  ],
};

export const IMMUTABLE_STATES: InvoiceStatus[] = [
  InvoiceStatus.AUTORIZADA,
  InvoiceStatus.ANULADA,
  InvoiceStatus.PENDIENTE_DE_ANULACION,
];

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Transición de estado no permitida: ${from} -> ${to}`,
    );
  }
}
