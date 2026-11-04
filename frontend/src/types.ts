export type UserRole = 'ADMIN' | 'BILLING' | 'ANALYST' | 'VIEWER';

export type InvoiceStatus =
  | 'BORRADOR'
  | 'PENDIENTE_DE_VALIDACION'
  | 'PENDIENTE_DE_ENVIO'
  | 'EN_PROCESAMIENTO'
  | 'AUTORIZADA'
  | 'RECHAZADA'
  | 'PENDIENTE_DE_ANULACION'
  | 'ANULADA'
  | 'EN_CONTINGENCIA';

export type DocumentType = 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
export type TaxEnvironment = 'SIMULATED' | 'TEST' | 'PRODUCTION';
export type TaxModality =
  | 'ELECTRONICA_EN_LINEA'
  | 'COMPUTARIZADA_EN_LINEA'
  | 'PORTAL_WEB_EN_LINEA';
export type ValidationStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'DEPRECATED';
export type ContingencyStatus = 'ABIERTA' | 'CERRADA' | 'REGULARIZADA';
export type CancellationStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'REVERTIDA';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: string | number;
  user: AuthUser;
}

export interface Issuer {
  id: string;
  nit: string;
  legalName: string;
  businessName?: string | null;
  economicActivityCode?: string | null;
  address: string;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  branches?: Branch[];
  configurations?: TaxConfiguration[];
}

export interface Branch {
  id: string;
  issuerId: string;
  code: string;
  name: string;
  address: string;
  municipality?: string | null;
  active: boolean;
  pointsOfSale?: PointOfSale[];
}

export interface PointOfSale {
  id: string;
  branchId: string;
  code: string;
  name: string;
  active: boolean;
}

export interface TaxRule {
  id: string;
  configurationId: string;
  code: string;
  name: string;
  taxType: string;
  rate: string;
  sourceReference: string;
  validationStatus: ValidationStatus;
}

export interface TaxConfiguration {
  id: string;
  issuerId: string;
  name: string;
  version: number;
  environment: TaxEnvironment;
  modality: TaxModality;
  currency: string;
  priceIncludesTax: boolean;
  defaultTaxRate: string;
  roundingMode: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  sourceReference: string;
  validationStatus: ValidationStatus;
  verifiedBy?: string | null;
  notes?: string | null;
  active: boolean;
  rules?: TaxRule[];
  issuer?: Pick<Issuer, 'id' | 'nit' | 'legalName'>;
}

export interface Customer {
  id: string;
  documentType: string;
  documentNumber: string;
  businessName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxpayerType?: string | null;
  sakilaCustomerId?: number | null;
  active: boolean;
  createdAt?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  active: boolean;
  sakilaCategoryId?: number | null;
  sakilaCategory?: { categoryId: number; name: string } | null;
}

export interface Product {
  id: string;
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  unitOfMeasure: string;
  unitPrice: string;
  taxCode?: string | null;
  taxRate: string;
  taxIncluded: boolean;
  sakilaFilmId?: number | null;
  active: boolean;
  category?: Pick<ProductCategory, 'id' | 'name'>;
  sakilaFilm?: { filmId: number; title: string } | null;
}

export interface InvoiceItem {
  id?: string;
  invoiceId?: string;
  productId?: string | null;
  lineNumber: number;
  description: string;
  productCode?: string | null;
  unitOfMeasure?: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  lineSubtotal: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  type: string;
  fromStatus?: InvoiceStatus | null;
  toStatus?: InvoiceStatus | null;
  message?: string | null;
  payload?: unknown;
  correlationId?: string | null;
  createdAt: string;
}

export interface InvoiceDocument {
  id: string;
  invoiceId: string;
  profileId: string;
  xml: string;
  xmlHash: string;
  xsdVersion: string;
  xsdValidated: boolean;
  signatureStatus: string;
  signatureProvider: string;
  signedAt: string;
}

export interface Invoice {
  id: string;
  publicId: string;
  number: number;
  serie: string;
  cuf?: string | null;
  cufd?: string | null;
  controlCode?: string | null;
  documentType: DocumentType;
  status: InvoiceStatus;
  taxStatus?: string | null;
  issueDate: string;
  currency: string;
  exchangeRate: string;
  subtotal: string;
  discountTotal: string;
  taxableBase: string;
  taxTotal: string;
  total: string;
  receptionCode?: string | null;
  authorizationCode?: string | null;
  simulated?: boolean;
  frozenAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  issuerId: string;
  branchId: string;
  pointOfSaleId: string;
  customerId: string;
  configurationId: string;
  contingencyId?: string | null;
  idempotencyKey?: string;
  issuer?: Issuer;
  branch?: Branch;
  pointOfSale?: PointOfSale;
  configuration?: TaxConfiguration;
  customer?: Customer;
  contingency?: Contingency | null;
  items?: InvoiceItem[];
  document?: InvoiceDocument | null;
  events?: InvoiceEvent[];
}

export interface InvoiceXml {
  invoiceId: string;
  publicId: string;
  cuf?: string | null;
  profileId: string;
  xml: string;
  hash: string;
  signatureStatus: string;
  signatureProvider: string;
  signedAt?: string;
  xsdValidated?: boolean;
  simulated?: boolean;
  disclaimer?: string;
}

export interface InvoiceCreateResult {
  invoice: Invoice;
  idempotent: boolean;
}

export interface InvoiceEmitResult {
  invoice: Invoice;
  idempotent: boolean;
  signature: { status: string; provider: string; xmlHash: string; signedAt: string } | null;
}

export interface InvoiceSendResult {
  invoice: Invoice;
  idempotent: boolean;
  result: {
    success: boolean;
    code: string;
    message: string;
    receptionCode?: string;
    authorizationCode?: string;
    simulated?: boolean;
  };
}

export interface Contingency {
  id: string;
  issuerId: string;
  type: string;
  description: string;
  status: ContingencyStatus;
  startedAt: string;
  endedAt?: string | null;
  reportedAt?: string | null;
  eventCode?: string | null;
  createdAt?: string;
  issuer?: Pick<Issuer, 'id' | 'nit' | 'legalName'>;
  invoices?: Array<Pick<Invoice, 'id' | 'publicId' | 'status' | 'total' | 'issueDate'>>;
  _count?: { invoices: number };
}

export interface CancellationRequest {
  id: string;
  invoiceId: string;
  reason: string;
  requestedBy: string;
  status: CancellationStatus;
  requestedAt: string;
  resolvedAt?: string | null;
  responseCode?: string | null;
  responseMessage?: string | null;
  invoice?: Pick<Invoice, 'id' | 'publicId' | 'status' | 'total'>;
  reversals?: Array<{ id: string; status: string; requestedAt: string }>;
}

export interface AuditLog {
  id: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface HealthResponse {
  status: string;
  timestamp?: string;
  certified?: boolean;
  provider?: string;
  environment?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ReadyResponse {
  ready: boolean;
  database: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ReportSummary {
  range: { from: string; to: string };
  issuerId: string | null;
  allInvoices: { count: number; total: string; taxTotal: string };
  authorizedInvoices: {
    count: number;
    subtotal: string;
    discountTotal: string;
    taxableBase: string;
    taxTotal: string;
    total: string;
  };
  byStatus: Array<{ status: InvoiceStatus; count: number; total: string }>;
  disclaimer: string;
}

export interface ReportTaxRow {
  taxRate: string;
  lines: number;
  taxableBase: string;
  taxAmount: string;
  lineTotal: string;
}

export interface ReportTax {
  range: { from: string; to: string };
  rates: ReportTaxRow[];
  disclaimer: string;
}

export interface ReportCustomerRow {
  customer: Pick<Customer, 'id' | 'businessName' | 'documentNumber' | 'documentType'>;
  invoiceCount: number;
  total: string;
  taxTotal: string;
}

export interface ReportCustomers {
  range: { from: string; to: string };
  customers: ReportCustomerRow[];
}

export interface ReportDailyRow {
  day: string;
  invoices: number;
  subtotal: string;
  tax: string;
  total: string;
}

export interface ReportDaily {
  range: { from: string; to: string };
  days: ReportDailyRow[];
}

export interface SakilaCustomer {
  customerId: number;
  storeId: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  activebool: boolean;
  taxCustomer?: { id: string; documentType: string; documentNumber: string } | null;
}

export interface SakilaFilm {
  filmId: number;
  title: string;
  description?: string | null;
  rentalRate: string;
  rating?: string | null;
  releaseYear?: number | null;
  taxProduct?: { id: string; sku: string; unitPrice: string } | null;
  filmCategories?: Array<{ category: { categoryId: number; name: string } }>;
}
