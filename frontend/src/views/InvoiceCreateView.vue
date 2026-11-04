<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api, errorMessage, type CreateInvoicePayload } from '../lib/api';
import { documentTypeLabels, formatMoney, prettyJson } from '../lib/format';
import { notify } from '../lib/toast';
import type {
  Contingency,
  Customer,
  DocumentType,
  Invoice,
  InvoiceCreateResult,
  Issuer,
  Product,
} from '../types';

interface DraftItem {
  key: string;
  productId: string;
  description: string;
  productCode: string;
  unitOfMeasure: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  taxCode: string;
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowLocalInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function emptyItem(): DraftItem {
  return {
    key: newKey(),
    productId: '',
    description: '',
    productCode: '',
    unitOfMeasure: '',
    quantity: '1',
    unitPrice: '',
    discount: '0',
    taxRate: '',
    taxCode: '',
  };
}

const router = useRouter();

const issuers = ref<Issuer[]>([]);
const customers = ref<Customer[]>([]);
const products = ref<Product[]>([]);
const openContingencies = ref<Contingency[]>([]);
const authorizedInvoices = ref<Invoice[]>([]);
const loadingRefs = ref(true);
const loadingError = ref('');
const submitting = ref(false);
const error = ref('');
const result = ref<InvoiceCreateResult | null>(null);

const form = reactive({
  issuerId: '',
  branchId: '',
  pointOfSaleId: '',
  configurationId: '',
  customerId: '',
  documentType: 'FACTURA' as DocumentType,
  originalInvoiceId: '',
  serie: 'A',
  issueDate: nowLocalInput(),
  currency: 'BOB',
  contingencyId: '',
  idempotencyKey: newKey(),
});

const items = ref<DraftItem[]>([emptyItem()]);

const selectedIssuer = computed(() => issuers.value.find((issuer) => issuer.id === form.issuerId));
const branches = computed(() => selectedIssuer.value?.branches ?? []);
const selectedBranch = computed(() => branches.value.find((branch) => branch.id === form.branchId));
const pointsOfSale = computed(() => selectedBranch.value?.pointsOfSale ?? []);
const configurations = computed(() => selectedIssuer.value?.configurations ?? []);
const availableContingencies = computed(() =>
  openContingencies.value.filter((event) => event.issuerId === form.issuerId),
);
const availableOriginalInvoices = computed(() =>
  authorizedInvoices.value.filter(
    (invoice) =>
      (!form.issuerId || invoice.issuerId === form.issuerId) &&
      (!form.customerId || invoice.customerId === form.customerId),
  ),
);

const totals = computed(() => {
  let subtotal = 0;
  let tax = 0;
  for (const item of items.value) {
    const lineSubtotal = lineSubtotalOf(item);
    subtotal += lineSubtotal;
    tax += lineSubtotal * Number(item.taxRate || 0);
  }
  return { subtotal, tax, total: subtotal + tax };
});

function lineSubtotalOf(item: DraftItem): number {
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const discount = Number(item.discount || 0);
  return Math.max(0, quantity * unitPrice - discount);
}

function lineTotalOf(item: DraftItem): number {
  return lineSubtotalOf(item) * (1 + Number(item.taxRate || 0));
}

function onIssuerChange(): void {
  form.branchId = '';
  form.pointOfSaleId = '';
  form.configurationId = '';
  form.contingencyId = '';
  form.originalInvoiceId = '';

  const issuer = selectedIssuer.value;
  const branch = issuer?.branches?.find((candidate) => candidate.active) ?? issuer?.branches?.[0];
  if (branch) {
    form.branchId = branch.id;
    onBranchChange();
  }
  const configuration =
    issuer?.configurations?.find((candidate) => candidate.active) ?? issuer?.configurations?.[0];
  if (configuration) form.configurationId = configuration.id;
}

function onBranchChange(): void {
  form.pointOfSaleId = '';
  const branch = selectedBranch.value;
  const pointOfSale =
    branch?.pointsOfSale?.find((candidate) => candidate.active) ?? branch?.pointsOfSale?.[0];
  if (pointOfSale) form.pointOfSaleId = pointOfSale.id;
}

function applyProduct(item: DraftItem): void {
  const product = products.value.find((candidate) => candidate.id === item.productId);
  if (!product) return;
  item.description = product.name;
  item.productCode = product.sku;
  item.unitOfMeasure = product.unitOfMeasure;
  item.unitPrice = product.unitPrice;
  item.taxRate = product.taxRate;
  item.taxCode = product.taxCode || '';
}

function addItem(): void {
  items.value.push(emptyItem());
}

function removeItem(index: number): void {
  if (items.value.length <= 1) return;
  items.value.splice(index, 1);
}

function resetForm(): void {
  form.documentType = 'FACTURA';
  form.originalInvoiceId = '';
  form.serie = 'A';
  form.issueDate = nowLocalInput();
  form.contingencyId = '';
  form.idempotencyKey = newKey();
  items.value = [emptyItem()];
  result.value = null;
  error.value = '';
}

async function loadReferences(): Promise<void> {
  loadingRefs.value = true;
  loadingError.value = '';
  try {
    const [issuerList, customerPage, productPage, contingencyList, invoicePage] =
      await Promise.all([
        api.issuers.list(),
        api.customers.list({ page: 1, limit: 100 }),
        api.products.list({ page: 1, limit: 100, active: 'true' }),
        api.contingencies.list({ status: 'ABIERTA' }),
        api.invoices.list({ page: 1, limit: 100, status: 'AUTORIZADA' }),
      ]);

    issuers.value = issuerList;
    customers.value = customerPage.data.filter((customer) => customer.active);
    products.value = productPage.data.filter((product) => product.active);
    openContingencies.value = contingencyList;
    authorizedInvoices.value = invoicePage.data;

    const firstIssuer = issuers.value.find((issuer) => issuer.active) ?? issuers.value[0];
    if (firstIssuer) {
      form.issuerId = firstIssuer.id;
      onIssuerChange();
    }
    form.customerId = customers.value[0]?.id ?? '';
  } catch (caught) {
    loadingError.value = errorMessage(caught);
    notify(loadingError.value, 'error');
  } finally {
    loadingRefs.value = false;
  }
}

function validate(): string {
  if (!form.issuerId) return 'Seleccione un emisor.';
  if (!form.branchId) return 'Seleccione una sucursal.';
  if (!form.pointOfSaleId) return 'Seleccione un punto de venta.';
  if (!form.customerId) return 'Seleccione un cliente.';
  if (!form.serie.trim()) return 'Ingrese la serie.';
  if (form.documentType !== 'FACTURA' && !form.originalInvoiceId.trim()) {
    return 'Las notas de crédito o débito requieren la factura original.';
  }
  if (items.value.length === 0) return 'Agregue al menos una línea.';

  for (const [index, item] of items.value.entries()) {
    if (!item.productId && !item.description.trim()) {
      return `La línea ${index + 1} requiere producto o descripción.`;
    }
    if (Number(item.quantity) <= 0) return `La línea ${index + 1} requiere cantidad mayor a cero.`;
    if (!item.productId && item.unitPrice === '') {
      return `La línea ${index + 1} requiere precio unitario.`;
    }
  }
  return '';
}

async function submit(): Promise<void> {
  error.value = '';
  const validation = validate();
  if (validation) {
    error.value = validation;
    notify(validation, 'warning');
    return;
  }

  const payload: CreateInvoicePayload = {
    issuerId: form.issuerId,
    branchId: form.branchId,
    pointOfSaleId: form.pointOfSaleId,
    customerId: form.customerId,
    documentType: form.documentType,
    serie: form.serie.trim().toUpperCase(),
    items: items.value.map((item) => ({
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.description.trim() ? { description: item.description.trim() } : {}),
      ...(item.productCode.trim() ? { productCode: item.productCode.trim() } : {}),
      ...(item.unitOfMeasure.trim() ? { unitOfMeasure: item.unitOfMeasure.trim() } : {}),
      quantity: item.quantity,
      ...(item.unitPrice !== '' ? { unitPrice: item.unitPrice } : {}),
      discount: item.discount || '0',
      ...(item.taxRate !== '' ? { taxRate: item.taxRate } : {}),
      ...(item.taxCode.trim() ? { taxCode: item.taxCode.trim() } : {}),
    })),
  };

  if (form.configurationId) payload.configurationId = form.configurationId;
  if (form.issueDate) payload.issueDate = new Date(form.issueDate).toISOString();
  if (form.currency) payload.currency = form.currency;
  if (form.contingencyId) payload.contingencyId = form.contingencyId;
  if (form.originalInvoiceId.trim()) payload.originalInvoiceId = form.originalInvoiceId.trim();

  submitting.value = true;
  try {
    const created = await api.invoices.create(payload, form.idempotencyKey);
    result.value = created;
    form.idempotencyKey = created.invoice.idempotencyKey || form.idempotencyKey;
    notify(
      created.idempotent
        ? 'La factura ya existía para esa clave de idempotencia.'
        : 'Factura creada en estado borrador.',
      created.idempotent ? 'info' : 'success',
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadReferences);
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Nueva factura</h2>
        <p class="hint">Crea un borrador. Luego podrá emitirlo y enviarlo desde el detalle.</p>
      </div>
      <div class="spacer" />
      <RouterLink class="btn btn-secondary btn-sm" to="/invoices">← Volver al listado</RouterLink>
    </div>

    <div v-if="result" class="card" style="border-color: #86efac; background: #f0fdf4">
      <div class="card-body">
        <div class="row">
          <div>
            <strong>Factura {{ result.invoice.serie }}-{{ result.invoice.number }} creada</strong>
            <p class="hint">
              {{ result.idempotent ? 'Resultado idempotente: la factura ya existía.' : 'Borrador registrado correctamente.' }}
            </p>
          </div>
          <div class="spacer" />
          <button class="btn btn-secondary btn-sm" type="button" @click="resetForm">
            Crear otra
          </button>
          <button
            class="btn btn-primary btn-sm"
            type="button"
            @click="router.push(`/invoices/${result.invoice.id}`)"
          >
            Ver factura
          </button>
        </div>
        <p class="mono hint" style="margin-top: 10px">
          {{ result.invoice.id }} · {{ result.invoice.publicId }}
        </p>
        <details style="margin-top: 10px">
          <summary class="hint">Ver respuesta completa</summary>
          <pre class="code-block" style="margin-top: 8px">{{ prettyJson(result) }}</pre>
        </details>
      </div>
    </div>

    <div v-if="loadingError" class="alert alert-error">{{ loadingError }}</div>
    <div v-else-if="loadingRefs" class="card">
      <div class="loading-row"><span class="spinner" /> Cargando emisores, clientes y productos…</div>
    </div>

    <template v-else>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <section class="card">
        <header class="card-header">
          <div class="card-title">
            <h2>Datos del comprobante</h2>
            <p>Emisor, punto de venta y cliente</p>
          </div>
          <span class="badge badge-info">{{ documentTypeLabels[form.documentType] }}</span>
        </header>
        <div class="card-body">
          <div class="form-grid cols-3">
            <div class="field span-2">
              <label for="issuer">Emisor</label>
              <select id="issuer" v-model="form.issuerId" @change="onIssuerChange">
                <option value="" disabled>Seleccione un emisor</option>
                <option v-for="issuer in issuers" :key="issuer.id" :value="issuer.id">
                  {{ issuer.legalName }} · NIT {{ issuer.nit }}
                </option>
              </select>
            </div>

            <div class="field">
              <label for="documentType">Tipo de documento</label>
              <select id="documentType" v-model="form.documentType">
                <option v-for="(label, value) in documentTypeLabels" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>

            <div class="field">
              <label for="branch">Sucursal</label>
              <select id="branch" v-model="form.branchId" @change="onBranchChange">
                <option value="" disabled>Seleccione sucursal</option>
                <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                  {{ branch.code }} · {{ branch.name }}
                </option>
              </select>
            </div>

            <div class="field">
              <label for="pos">Punto de venta</label>
              <select id="pos" v-model="form.pointOfSaleId">
                <option value="" disabled>Seleccione punto de venta</option>
                <option v-for="pos in pointsOfSale" :key="pos.id" :value="pos.id">
                  {{ pos.code }} · {{ pos.name }}
                </option>
              </select>
            </div>

            <div class="field">
              <label for="configuration">Configuración tributaria</label>
              <select id="configuration" v-model="form.configurationId">
                <option value="">Vigente por defecto</option>
                <option v-for="configuration in configurations" :key="configuration.id" :value="configuration.id">
                  v{{ configuration.version }} · {{ configuration.name }}
                </option>
              </select>
            </div>

            <div class="field span-2">
              <label for="customer">Cliente</label>
              <select id="customer" v-model="form.customerId">
                <option value="" disabled>Seleccione un cliente</option>
                <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                  {{ customer.businessName }} · {{ customer.documentType }} {{ customer.documentNumber }}
                </option>
              </select>
            </div>

            <div class="field">
              <label for="serie">Serie</label>
              <input id="serie" v-model="form.serie" maxlength="20" />
            </div>

            <div class="field">
              <label for="issueDate">Fecha y hora de emisión</label>
              <input id="issueDate" v-model="form.issueDate" type="datetime-local" />
            </div>

            <div class="field">
              <label for="currency">Moneda</label>
              <select id="currency" v-model="form.currency">
                <option value="BOB">BOB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div class="field span-2" v-if="form.documentType !== 'FACTURA'">
              <label for="originalInvoice">Factura original (UUID)</label>
              <select id="originalInvoice" v-model="form.originalInvoiceId">
                <option value="">Seleccione una factura autorizada</option>
                <option
                  v-for="invoice in availableOriginalInvoices"
                  :key="invoice.id"
                  :value="invoice.id"
                >
                  {{ invoice.serie }}-{{ invoice.number }} · {{ formatMoney(invoice.total) }} ·
                  {{ invoice.publicId }}
                </option>
              </select>
              <small>Debe pertenecer al mismo emisor y cliente.</small>
            </div>

            <div class="field span-2">
              <label for="contingency">Evento de contingencia (opcional)</label>
              <select id="contingency" v-model="form.contingencyId">
                <option value="">Sin contingencia</option>
                <option v-for="event in availableContingencies" :key="event.id" :value="event.id">
                  {{ event.type }} · {{ event.id.slice(0, 8) }}
                </option>
              </select>
              <small>Si se asocia, la factura nace en estado EN_CONTINGENCIA.</small>
            </div>

            <div class="field span-2">
              <label for="idempotency">Clave de idempotencia</label>
              <div class="row" style="flex-wrap: nowrap">
                <input id="idempotency" v-model="form.idempotencyKey" class="mono" minlength="8" maxlength="120" />
                <button class="btn btn-secondary" type="button" @click="form.idempotencyKey = newKey()">
                  Regenerar
                </button>
              </div>
              <small>Se envía también en el header <code>Idempotency-Key</code>.</small>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card-header">
          <div class="card-title">
            <h2>Líneas de la factura</h2>
            <p>Use un producto fiscal o escriba una línea libre</p>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" @click="addItem">+ Agregar línea</button>
        </header>
        <div class="card-body section-stack" style="gap: 14px">
          <div
            v-for="(item, index) in items"
            :key="item.key"
            class="card"
            style="box-shadow: none; background: #fbfdff"
          >
            <header class="card-header" style="padding: 12px 16px">
              <div class="card-title"><h3>Línea {{ index + 1 }}</h3></div>
              <div class="row">
                <strong>{{ formatMoney(lineTotalOf(item)) }}</strong>
                <button
                  class="btn btn-ghost btn-sm"
                  type="button"
                  :disabled="items.length <= 1"
                  @click="removeItem(index)"
                >
                  Quitar
                </button>
              </div>
            </header>
            <div class="card-body" style="padding: 16px">
              <div class="form-grid cols-3">
                <div class="field span-2">
                  <label :for="`product-${item.key}`">Producto fiscal</label>
                  <select
                    :id="`product-${item.key}`"
                    v-model="item.productId"
                    @change="applyProduct(item)"
                  >
                    <option value="">Línea libre (sin producto)</option>
                    <option v-for="product in products" :key="product.id" :value="product.id">
                      {{ product.sku }} · {{ product.name }} · {{ formatMoney(product.unitPrice) }}
                    </option>
                  </select>
                </div>

                <div class="field">
                  <label :for="`qty-${item.key}`">Cantidad</label>
                  <input
                    :id="`qty-${item.key}`"
                    v-model="item.quantity"
                    type="number"
                    min="0.0001"
                    step="any"
                  />
                </div>

                <div class="field span-2">
                  <label :for="`desc-${item.key}`">Descripción</label>
                  <input
                    :id="`desc-${item.key}`"
                    v-model="item.description"
                    maxlength="500"
                    placeholder="Descripción de la línea"
                  />
                </div>

                <div class="field">
                  <label :for="`unit-${item.key}`">Unidad de medida</label>
                  <input :id="`unit-${item.key}`" v-model="item.unitOfMeasure" maxlength="20" placeholder="UNIDAD" />
                </div>

                <div class="field">
                  <label :for="`price-${item.key}`">Precio unitario</label>
                  <input
                    :id="`price-${item.key}`"
                    v-model="item.unitPrice"
                    type="number"
                    min="0"
                    step="any"
                  />
                </div>

                <div class="field">
                  <label :for="`discount-${item.key}`">Descuento (monto)</label>
                  <input
                    :id="`discount-${item.key}`"
                    v-model="item.discount"
                    type="number"
                    min="0"
                    step="any"
                  />
                </div>

                <div class="field">
                  <label :for="`tax-${item.key}`">Tasa de impuesto</label>
                  <input
                    :id="`tax-${item.key}`"
                    v-model="item.taxRate"
                    type="number"
                    min="0"
                    max="1"
                    step="0.000001"
                    placeholder="0.130000"
                  />
                  <small>Decimal: 0.13 equivale a 13 %.</small>
                </div>

                <div class="field">
                  <label :for="`code-${item.key}`">Código de producto</label>
                  <input :id="`code-${item.key}`" v-model="item.productCode" maxlength="80" />
                </div>

                <div class="field">
                  <label :for="`taxcode-${item.key}`">Código tributario</label>
                  <input :id="`taxcode-${item.key}`" v-model="item.taxCode" maxlength="40" placeholder="IVA" />
                </div>

                <div class="field">
                  <label>Subtotal de línea</label>
                  <input :value="formatMoney(lineSubtotalOf(item))" disabled />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-body">
          <div class="row" style="align-items: flex-start">
            <div>
              <p class="hint">
                Vista previa aproximada. El backend aplica redondeo, impuesto incluido y reglas de la
                configuración seleccionada.
              </p>
              <p class="hint" style="margin-top: 4px">
                Clave de idempotencia: <span class="mono">{{ form.idempotencyKey }}</span>
              </p>
            </div>
            <div class="spacer" />
            <div class="kv" style="grid-template-columns: auto auto; gap: 4px 18px">
              <span>Subtotal</span><strong>{{ formatMoney(totals.subtotal) }}</strong>
              <span>Impuestos</span><strong>{{ formatMoney(totals.tax) }}</strong>
              <span>Total</span><strong>{{ formatMoney(totals.total) }}</strong>
            </div>
          </div>
          <div class="form-actions" style="margin-top: 16px">
            <button class="btn btn-secondary" type="button" @click="resetForm">Limpiar</button>
            <button class="btn btn-primary" type="button" :disabled="submitting" @click="submit">
              <span v-if="submitting" class="spinner" />
              {{ submitting ? 'Creando…' : 'Crear factura borrador' }}
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
