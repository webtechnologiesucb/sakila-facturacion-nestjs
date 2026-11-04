import type {
  AuditLog,
  AuthUser,
  CancellationRequest,
  Contingency,
  ContingencyStatus,
  Customer,
  DocumentType,
  HealthResponse,
  Invoice,
  InvoiceCreateResult,
  InvoiceEmitResult,
  InvoiceSendResult,
  InvoiceStatus,
  InvoiceXml,
  Issuer,
  LoginResponse,
  Paginated,
  Product,
  ProductCategory,
  ReadyResponse,
  ReportCustomers,
  ReportDaily,
  ReportSummary,
  ReportTax,
  SakilaCustomer,
  SakilaFilm,
  TaxConfiguration,
  TaxRule,
  UserRole,
  Branch,
  PointOfSale,
} from '../types';
import {
  API_BASE_URL,
  onUnauthorized,
  refreshSession,
  session,
} from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function extractMessage(payload: any, fallback: string): string {
  const raw = payload?.message;
  if (Array.isArray(raw)) return raw.join(' · ');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const useAuth = options.auth !== false;
  if (useAuth && session.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(options.query)}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      `No se pudo conectar con la API en ${API_BASE_URL}. Verifique que el backend esté en ejecución.`,
      0,
    );
  }

  if (response.status === 401 && useAuth && !retried && session.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, true);
    onUnauthorized();
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractMessage(payload, `Error HTTP ${response.status}`),
      response.status,
      payload?.details,
      payload?.requestId,
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

/* -------------------------------------------------------------------------- */
/* Tipos de entrada                                                           */
/* -------------------------------------------------------------------------- */

export interface InvoiceItemPayload {
  productId?: string;
  description?: string;
  productCode?: string;
  unitOfMeasure?: string;
  quantity: number | string;
  unitPrice?: number | string;
  discount?: number | string;
  taxRate?: number | string;
  taxCode?: string;
}

export interface CreateInvoicePayload {
  issuerId: string;
  branchId: string;
  pointOfSaleId: string;
  configurationId?: string;
  customerId: string;
  documentType?: DocumentType;
  originalInvoiceId?: string;
  serie: string;
  issueDate?: string;
  currency?: string;
  exchangeRate?: number | string;
  contingencyId?: string;
  idempotencyKey?: string;
  items: InvoiceItemPayload[];
}

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  status?: InvoiceStatus | '';
  documentType?: DocumentType | '';
  issuerId?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

export interface ReportQuery {
  from?: string;
  to?: string;
  issuerId?: string;
}

export interface CreateCustomerPayload {
  documentType: string;
  documentNumber: string;
  businessName: string;
  email?: string;
  phone?: string;
  address?: string;
  taxpayerType?: string;
  sakilaCustomerId?: number;
  active?: boolean;
}

export interface CreateProductPayload {
  categoryId: string;
  sku: string;
  name: string;
  description?: string;
  unitOfMeasure: string;
  unitPrice: number | string;
  taxCode?: string;
  taxRate: number | string;
  taxIncluded?: boolean;
  sakilaFilmId?: number;
  active?: boolean;
}

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
      }),
    me: () => request<AuthUser>('/auth/me'),
  },

  system: {
    health: () => request<HealthResponse>('/health', { auth: false }),
    ready: () => request<ReadyResponse>('/ready', { auth: false }),
  },

  invoices: {
    list: (query: InvoiceListQuery = {}) =>
      request<Paginated<Invoice>>('/invoices', { query: { ...query } }),
    get: (id: string) => request<Invoice>(`/invoices/${id}`),
    create: (payload: CreateInvoicePayload, idempotencyKey?: string) =>
      request<InvoiceCreateResult>('/invoices', {
        method: 'POST',
        body: payload,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      }),
    emit: (id: string) =>
      request<InvoiceEmitResult>(`/invoices/${id}/emit`, { method: 'POST' }),
    send: (id: string) =>
      request<InvoiceSendResult>(`/invoices/${id}/send`, { method: 'POST' }),
    xml: (id: string) => request<InvoiceXml>(`/invoices/${id}/xml`),
  },

  customers: {
    list: (query: { page?: number; limit?: number; search?: string } = {}) =>
      request<Paginated<Customer>>('/customers', { query: { ...query } }),
    create: (payload: CreateCustomerPayload) =>
      request<Customer>('/customers', { method: 'POST', body: payload }),
    update: (id: string, payload: Partial<CreateCustomerPayload>) =>
      request<Customer>(`/customers/${id}`, { method: 'PATCH', body: payload }),
  },

  categories: {
    list: () => request<ProductCategory[]>('/product-categories'),
    create: (payload: { name: string; sakilaCategoryId?: number; active?: boolean }) =>
      request<ProductCategory>('/product-categories', { method: 'POST', body: payload }),
    update: (
      id: string,
      payload: { name?: string; sakilaCategoryId?: number; active?: boolean },
    ) => request<ProductCategory>(`/product-categories/${id}`, { method: 'PATCH', body: payload }),
  },

  products: {
    list: (query: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      active?: string;
    } = {}) => request<Paginated<Product>>('/products', { query: { ...query } }),
    create: (payload: CreateProductPayload) =>
      request<Product>('/products', { method: 'POST', body: payload }),
    update: (id: string, payload: Partial<CreateProductPayload>) =>
      request<Product>(`/products/${id}`, { method: 'PATCH', body: payload }),
  },

  issuers: {
    list: () => request<Issuer[]>('/issuers'),
    get: (id: string) => request<Issuer>(`/issuers/${id}`),
    create: (payload: Record<string, unknown>) =>
      request<Issuer>('/issuers', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<Issuer>(`/issuers/${id}`, { method: 'PATCH', body: payload }),
    branches: (issuerId: string) => request<Branch[]>(`/issuers/${issuerId}/branches`),
    createBranch: (issuerId: string, payload: Record<string, unknown>) =>
      request<Branch>(`/issuers/${issuerId}/branches`, { method: 'POST', body: payload }),
    updateBranch: (id: string, payload: Record<string, unknown>) =>
      request<Branch>(`/branches/${id}`, { method: 'PATCH', body: payload }),
    pointsOfSale: (branchId: string) =>
      request<PointOfSale[]>(`/branches/${branchId}/points-of-sale`),
    createPointOfSale: (branchId: string, payload: Record<string, unknown>) =>
      request<PointOfSale>(`/branches/${branchId}/points-of-sale`, {
        method: 'POST',
        body: payload,
      }),
    updatePointOfSale: (id: string, payload: Record<string, unknown>) =>
      request<PointOfSale>(`/points-of-sale/${id}`, { method: 'PATCH', body: payload }),
  },

  taxConfigurations: {
    list: (issuerId?: string) =>
      request<TaxConfiguration[]>('/tax-configurations', { query: { issuerId } }),
    get: (id: string) => request<TaxConfiguration>(`/tax-configurations/${id}`),
    create: (payload: Record<string, unknown>) =>
      request<TaxConfiguration>('/tax-configurations', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<TaxConfiguration>(`/tax-configurations/${id}`, { method: 'PATCH', body: payload }),
    rules: (id: string) => request<TaxRule[]>(`/tax-configurations/${id}/rules`),
    createRule: (id: string, payload: Record<string, unknown>) =>
      request<TaxRule>(`/tax-configurations/${id}/rules`, { method: 'POST', body: payload }),
    updateRule: (id: string, payload: Record<string, unknown>) =>
      request<TaxRule>(`/tax-rules/${id}`, { method: 'PATCH', body: payload }),
  },

  contingencies: {
    list: (query: { issuerId?: string; status?: ContingencyStatus | '' } = {}) =>
      request<Contingency[]>('/contingencies', { query: { ...query } }),
    get: (id: string) => request<Contingency>(`/contingencies/${id}`),
    create: (payload: { issuerId: string; type: string; description: string }) =>
      request<Contingency>('/contingencies', { method: 'POST', body: payload }),
    close: (id: string, endedAt?: string) =>
      request<Contingency>(`/contingencies/${id}/close`, {
        method: 'POST',
        body: endedAt ? { endedAt } : {},
      }),
    report: (id: string, eventCode?: string) =>
      request<Contingency>(`/contingencies/${id}/report`, {
        method: 'POST',
        body: eventCode ? { eventCode } : {},
      }),
    attachInvoice: (id: string, invoiceId: string) =>
      request<Contingency>(`/contingencies/${id}/invoices/${invoiceId}`, { method: 'POST' }),
  },

  cancellations: {
    list: () => request<CancellationRequest[]>('/cancellation-requests'),
    listByInvoice: (invoiceId: string) =>
      request<CancellationRequest[]>(`/invoices/${invoiceId}/cancellation-requests`),
    request: (invoiceId: string, reason: string) =>
      request<{ request: CancellationRequest; result: Record<string, unknown> }>(
        `/invoices/${invoiceId}/cancellation-requests`,
        { method: 'POST', body: { reason } },
      ),
    reverse: (id: string, reason: string) =>
      request<{ request: CancellationRequest; result: Record<string, unknown> }>(
        `/cancellation-requests/${id}/reverse`,
        { method: 'POST', body: { reason } },
      ),
  },

  reports: {
    summary: (query: ReportQuery = {}) =>
      request<ReportSummary>('/reports/summary', { query: { ...query } }),
    tax: (query: ReportQuery = {}) => request<ReportTax>('/reports/tax', { query: { ...query } }),
    byCustomer: (query: ReportQuery = {}) =>
      request<ReportCustomers>('/reports/by-customer', { query: { ...query } }),
    daily: (query: ReportQuery = {}) =>
      request<ReportDaily>('/reports/daily', { query: { ...query } }),
  },

  audit: {
    list: (query: { page?: number; limit?: number; entity?: string } = {}) =>
      request<Paginated<AuditLog>>('/audit-logs', { query: { ...query } }),
  },

  users: {
    list: (query: { page?: number; limit?: number } = {}) =>
      request<Paginated<AuthUser & { active: boolean; createdAt: string }>>('/users', {
        query: { ...query },
      }),
    update: (id: string, payload: { role: UserRole; active?: boolean }) =>
      request<AuthUser & { active: boolean }>(`/users/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
  },

  sakila: {
    customers: (query: { page?: number; limit?: number } = {}) =>
      request<Paginated<SakilaCustomer>>('/sakila/customers', { query: { ...query } }),
    films: (query: { page?: number; limit?: number } = {}) =>
      request<Paginated<SakilaFilm>>('/sakila/films', { query: { ...query } }),
    categories: () => request<Array<Record<string, unknown>>>('/sakila/categories'),
    mapping: () => request<Record<string, unknown>>('/sakila/mapping'),
  },
};
