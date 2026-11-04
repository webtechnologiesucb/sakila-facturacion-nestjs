import type { DocumentType, InvoiceStatus, UserRole } from '../types';

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_DE_VALIDACION: 'Pend. de validación',
  PENDIENTE_DE_ENVIO: 'Pend. de envío',
  EN_PROCESAMIENTO: 'En procesamiento',
  AUTORIZADA: 'Autorizada',
  RECHAZADA: 'Rechazada',
  PENDIENTE_DE_ANULACION: 'Pend. de anulación',
  ANULADA: 'Anulada',
  EN_CONTINGENCIA: 'En contingencia',
};

export const invoiceStatusTone: Record<InvoiceStatus, string> = {
  BORRADOR: 'neutral',
  PENDIENTE_DE_VALIDACION: 'info',
  PENDIENTE_DE_ENVIO: 'warning',
  EN_PROCESAMIENTO: 'info',
  AUTORIZADA: 'success',
  RECHAZADA: 'danger',
  PENDIENTE_DE_ANULACION: 'warning',
  ANULADA: 'danger',
  EN_CONTINGENCIA: 'purple',
};

export const documentTypeLabels: Record<DocumentType, string> = {
  FACTURA: 'Factura',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
};

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  BILLING: 'Facturación',
  ANALYST: 'Analista',
  VIEWER: 'Consulta',
};

export const environmentLabels: Record<string, string> = {
  SIMULATED: 'Simulado',
  TEST: 'Pruebas',
  PRODUCTION: 'Producción',
};

export const modalityLabels: Record<string, string> = {
  ELECTRONICA_EN_LINEA: 'Electrónica en línea',
  COMPUTARIZADA_EN_LINEA: 'Computarizada en línea',
  PORTAL_WEB_EN_LINEA: 'Portal web en línea',
};

export const validationLabels: Record<string, string> = {
  PENDING_VERIFICATION: 'Pendiente de verificación',
  VERIFIED: 'Verificado',
  DEPRECATED: 'Obsoleto',
};

export const cancellationStatusLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  REVERTIDA: 'Revertida',
};

export const contingencyStatusLabels: Record<string, string> = {
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  REGULARIZADA: 'Regularizada',
};

export function formatMoney(value: string | number | null | undefined, currency = 'BOB'): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${value ?? 0}`;
  try {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: string | number | null | undefined, digits = 2): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? '');
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date);
}

export function toDateInput(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function daysAgoInput(days: number): string {
  return toDateInput(new Date(Date.now() - days * 24 * 3600 * 1000));
}

export function startOfDayIso(dateInput: string): string | undefined {
  if (!dateInput) return undefined;
  return new Date(`${dateInput}T00:00:00`).toISOString();
}

export function endOfDayIso(dateInput: string): string | undefined {
  if (!dateInput) return undefined;
  return new Date(`${dateInput}T23:59:59.999`).toISOString();
}

export function shortId(value: string | null | undefined): string {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function downloadText(filename: string, content: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function humanBytes(value: string): string {
  const bytes = new Blob([value]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
