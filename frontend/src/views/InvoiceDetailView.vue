<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppModal from '../components/AppModal.vue';
import JsonBlock from '../components/JsonBlock.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage } from '../lib/api';
import {
  cancellationStatusLabels,
  documentTypeLabels,
  downloadText,
  environmentLabels,
  formatDateTime,
  formatMoney,
  humanBytes,
  modalityLabels,
  prettyJson,
  validationLabels,
} from '../lib/format';
import { isAdmin } from '../lib/session';
import { notify } from '../lib/toast';
import type {
  CancellationRequest,
  Contingency,
  Invoice,
  InvoiceXml,
} from '../types';

const route = useRoute();
const invoiceId = String(route.params.id);

const invoice = ref<Invoice | null>(null);
const cancellations = ref<CancellationRequest[]>([]);
const openContingencies = ref<Contingency[]>([]);
const xml = ref<InvoiceXml | null>(null);
const loading = ref(true);
const error = ref('');
const action = ref('');
const cancellationReason = ref('');
const contingencyToAttach = ref('');
const reverseTarget = ref<CancellationRequest | null>(null);
const reverseReason = ref('');
const reverseOpen = ref(false);

const admin = computed(() => isAdmin());
const canEmit = computed(
  () => invoice.value?.status === 'BORRADOR' || invoice.value?.status === 'EN_CONTINGENCIA',
);
const canSend = computed(() => invoice.value?.status === 'PENDIENTE_DE_ENVIO');
const canRequestCancellation = computed(() => invoice.value?.status === 'AUTORIZADA');
const hasDocument = computed(() => Boolean(invoice.value?.document));
const xmlText = computed(() => xml.value?.xml || invoice.value?.document?.xml || '');
const attachableContingencies = computed(() =>
  openContingencies.value.filter((event) => event.issuerId === invoice.value?.issuerId),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [detail, cancellationList] = await Promise.all([
      api.invoices.get(invoiceId),
      api.cancellations.listByInvoice(invoiceId).catch(() => []),
    ]);
    invoice.value = detail;
    cancellations.value = cancellationList;
    if (detail.contingencyId) {
      openContingencies.value = [];
    } else {
      openContingencies.value = await api.contingencies
        .list({ issuerId: detail.issuerId, status: 'ABIERTA' })
        .catch(() => []);
    }
  } catch (caught) {
    error.value = errorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function emitInvoice(): Promise<void> {
  action.value = 'emit';
  try {
    const result = await api.invoices.emit(invoiceId);
    notify(
      result.idempotent
        ? 'La factura ya estaba emitida; no se regeneró el XML.'
        : 'Factura emitida: CUF, XML y firma simulada generados.',
      result.idempotent ? 'info' : 'success',
    );
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

async function sendInvoice(): Promise<void> {
  action.value = 'send';
  try {
    const result = await api.invoices.send(invoiceId);
    notify(
      result.result?.message ||
        (result.result?.success ? 'Factura autorizada por el proveedor simulado.' : 'Envío procesado.'),
      result.result?.success ? 'success' : 'warning',
    );
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

async function loadXml(): Promise<void> {
  action.value = 'xml';
  try {
    xml.value = await api.invoices.xml(invoiceId);
    notify('XML obtenido desde /invoices/:id/xml', 'success');
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

async function copyXml(): Promise<void> {
  if (!xmlText.value) return;
  try {
    await navigator.clipboard.writeText(xmlText.value);
    notify('XML copiado al portapapeles.', 'success');
  } catch {
    notify('No se pudo copiar. Use la descarga o seleccione el texto.', 'warning');
  }
}

function downloadXml(): void {
  if (!xmlText.value) return;
  downloadText(`${invoice.value?.publicId || invoiceId}.xml`, xmlText.value, 'application/xml');
}

async function requestCancellation(): Promise<void> {
  const reason = cancellationReason.value.trim();
  if (reason.length < 10) {
    notify('El motivo debe tener al menos 10 caracteres.', 'warning');
    return;
  }
  action.value = 'cancel';
  try {
    const result = await api.cancellations.request(invoiceId, reason);
    const status = String(result.request?.status || '');
    notify(
      status === 'APROBADA'
        ? 'Anulación aprobada por el proveedor simulado.'
        : `Solicitud registrada con estado ${cancellationStatusLabels[status] || status}.`,
      status === 'APROBADA' ? 'success' : 'info',
    );
    cancellationReason.value = '';
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

function openReverse(request: CancellationRequest): void {
  reverseTarget.value = request;
  reverseReason.value = '';
  reverseOpen.value = true;
}

async function confirmReverse(): Promise<void> {
  if (!reverseTarget.value) return;
  const reason = reverseReason.value.trim();
  if (reason.length < 10) {
    notify('El motivo debe tener al menos 10 caracteres.', 'warning');
    return;
  }
  action.value = 'reverse';
  try {
    await api.cancellations.reverse(reverseTarget.value.id, reason);
    notify('Anulación revertida correctamente.', 'success');
    reverseOpen.value = false;
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

async function attachContingency(): Promise<void> {
  if (!contingencyToAttach.value) return;
  action.value = 'attach';
  try {
    await api.contingencies.attachInvoice(contingencyToAttach.value, invoiceId);
    notify('Factura asociada al evento de contingencia.', 'success');
    contingencyToAttach.value = '';
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

onMounted(load);
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Detalle de factura</h2>
        <p class="hint">Consulte, emita, envíe y descargue el XML simulado.</p>
      </div>
      <div class="spacer" />
      <RouterLink class="btn btn-secondary btn-sm" to="/invoices">← Volver al listado</RouterLink>
    </div>

    <div v-if="loading" class="card">
      <div class="loading-row"><span class="spinner large" /> Cargando factura…</div>
    </div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <template v-else-if="invoice">
      <section class="card">
        <div class="card-body">
          <div class="row" style="align-items: flex-start">
            <div>
              <div class="row">
                <h2 class="mono" style="font-size: 19px">
                  {{ invoice.serie }}-{{ invoice.number }}
                </h2>
                <StatusBadge :status="invoice.status" />
                <span v-if="invoice.document" class="badge badge-neutral">Congelada</span>
                <span v-if="invoice.simulated" class="badge badge-purple">Simulada</span>
              </div>
              <p class="hint mono" style="margin-top: 4px">{{ invoice.publicId }}</p>
            </div>
            <div class="spacer" />
            <div class="page-actions">
              <button
                v-if="canEmit"
                class="btn btn-primary btn-sm"
                type="button"
                :disabled="action !== ''"
                @click="emitInvoice"
              >
                <span v-if="action === 'emit'" class="spinner" />
                Emitir y generar XML
              </button>
              <button
                v-if="canSend"
                class="btn btn-primary btn-sm"
                type="button"
                :disabled="action !== ''"
                @click="sendInvoice"
              >
                <span v-if="action === 'send'" class="spinner" />
                Enviar al proveedor
              </button>
              <button
                v-if="hasDocument"
                class="btn btn-secondary btn-sm"
                type="button"
                :disabled="action !== ''"
                @click="loadXml"
              >
                <span v-if="action === 'xml'" class="spinner" />
                Cargar XML
              </button>
              <button
                v-if="hasDocument"
                class="btn btn-secondary btn-sm"
                type="button"
                :disabled="!xmlText"
                @click="downloadXml"
              >
                Descargar XML
              </button>
            </div>
          </div>

          <div class="divider" />

          <div class="grid grid-4">
            <div>
              <p class="hint">Total</p>
              <strong style="font-size: 20px">{{ formatMoney(invoice.total, invoice.currency) }}</strong>
            </div>
            <div>
              <p class="hint">Emisión</p>
              <strong>{{ formatDateTime(invoice.issueDate) }}</strong>
            </div>
            <div>
              <p class="hint">Tipo</p>
              <strong>{{ documentTypeLabels[invoice.documentType] || invoice.documentType }}</strong>
            </div>
            <div>
              <p class="hint">Cliente</p>
              <strong>{{ invoice.customer?.businessName || '—' }}</strong>
            </div>
          </div>
        </div>
      </section>

      <div class="detail-grid">
        <div class="section-stack">
          <section class="card">
            <header class="card-header">
              <div class="card-title"><h2>Líneas</h2><p>{{ invoice.items?.length ?? 0 }} ítem(s)</p></div>
            </header>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Descripción</th>
                    <th>Código</th>
                    <th class="num">Cant.</th>
                    <th class="num">P. unit.</th>
                    <th class="num">Desc.</th>
                    <th class="num">Tasa</th>
                    <th class="num">Impuesto</th>
                    <th class="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in invoice.items" :key="item.lineNumber">
                    <td>{{ item.lineNumber }}</td>
                    <td>{{ item.description }}</td>
                    <td class="mono">{{ item.productCode || '—' }}</td>
                    <td class="num">{{ item.quantity }}</td>
                    <td class="num">{{ formatMoney(item.unitPrice, invoice.currency) }}</td>
                    <td class="num">{{ formatMoney(item.discount, invoice.currency) }}</td>
                    <td class="num">{{ Number(item.taxRate).toFixed(4) }}</td>
                    <td class="num">{{ formatMoney(item.taxAmount, invoice.currency) }}</td>
                    <td class="num"><strong>{{ formatMoney(item.lineTotal, invoice.currency) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="card-body" style="border-top: 1px solid var(--line)">
              <div class="kv" style="grid-template-columns: 1fr auto; max-width: 360px; margin-left: auto">
                <span>Subtotal</span><strong>{{ formatMoney(invoice.subtotal, invoice.currency) }}</strong>
                <span>Descuentos</span><strong>{{ formatMoney(invoice.discountTotal, invoice.currency) }}</strong>
                <span>Base imponible</span><strong>{{ formatMoney(invoice.taxableBase, invoice.currency) }}</strong>
                <span>Impuestos</span><strong>{{ formatMoney(invoice.taxTotal, invoice.currency) }}</strong>
                <span>Total</span><strong>{{ formatMoney(invoice.total, invoice.currency) }}</strong>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <div class="card-title"><h2>Eventos</h2><p>Historial de estados y auditoría funcional</p></div>
            </header>
            <div class="card-body">
              <div v-if="!invoice.events?.length" class="empty">Sin eventos registrados.</div>
              <div v-else class="timeline">
                <div v-for="event in invoice.events" :key="event.id" class="timeline-item">
                  <strong>{{ event.type }}</strong>
                  <span>{{ formatDateTime(event.createdAt) }}</span>
                  <p v-if="event.message">{{ event.message }}</p>
                  <p v-if="event.fromStatus || event.toStatus" class="hint">
                    {{ event.fromStatus || '—' }} → {{ event.toStatus || '—' }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <div class="card-title"><h2>Documento y XML</h2><p>Contenido simulado, sin validez fiscal</p></div>
              <span v-if="invoice.document" class="badge badge-success">
                {{ invoice.document.signatureStatus }}
              </span>
            </header>
            <div class="card-body section-stack" style="gap: 12px">
              <div v-if="!invoice.document" class="empty">
                <strong>La factura aún no tiene XML</strong>
                Emita la factura para generar el CUF, el XML y la firma simulada.
              </div>
              <template v-else>
                <div class="kv">
                  <span>CUF</span><span class="mono break">{{ invoice.cuf || '—' }}</span>
                  <span>CUFD</span><span class="mono break">{{ invoice.cufd || '—' }}</span>
                  <span>Código de control</span><span class="mono break">{{ invoice.controlCode || '—' }}</span>
                  <span>Perfil</span><span class="mono">{{ invoice.document.profileId }}</span>
                  <span>Hash XML</span><span class="mono break">{{ invoice.document.xmlHash }}</span>
                  <span>Firma</span><span>{{ invoice.document.signatureProvider }} · {{ invoice.document.signatureStatus }}</span>
                  <span>Firmado</span><span>{{ formatDateTime(invoice.document.signedAt) }}</span>
                  <span>Tamaño</span><span>{{ humanBytes(xmlText) }}</span>
                </div>
                <div class="row">
                  <button class="btn btn-secondary btn-sm" type="button" @click="copyXml" :disabled="!xmlText">
                    Copiar XML
                  </button>
                  <button class="btn btn-secondary btn-sm" type="button" @click="downloadXml" :disabled="!xmlText">
                    Descargar
                  </button>
                  <span class="hint">El endpoint XML se prueba con «Cargar XML».</span>
                </div>
                <pre v-if="xmlText" class="code-block" style="max-height: 440px">{{ xmlText }}</pre>
              </template>
            </div>
          </section>
        </div>

        <div class="section-stack">
          <section class="card">
            <header class="card-header"><div class="card-title"><h2>Información fiscal</h2></div></header>
            <div class="card-body">
              <dl class="kv">
                <dt>Emisor</dt>
                <dd>{{ invoice.issuer?.legalName }} · {{ invoice.issuer?.nit }}</dd>
                <dt>Sucursal</dt>
                <dd>{{ invoice.branch?.code }} · {{ invoice.branch?.name }}</dd>
                <dt>Punto de venta</dt>
                <dd>{{ invoice.pointOfSale?.code }} · {{ invoice.pointOfSale?.name }}</dd>
                <dt>Configuración</dt>
                <dd>
                  v{{ invoice.configuration?.version }} · {{ invoice.configuration?.name }}
                  <div class="hint">
                    {{ environmentLabels[invoice.configuration?.environment || ''] || '—' }} ·
                    {{ modalityLabels[invoice.configuration?.modality || ''] || '—' }}
                  </div>
                </dd>
                <dt>Validación tributaria</dt>
                <dd>{{ validationLabels[invoice.configuration?.validationStatus || ''] || '—' }}</dd>
                <dt>Moneda</dt>
                <dd>{{ invoice.currency }} · tipo de cambio {{ invoice.exchangeRate }}</dd>
                <dt>Cliente</dt>
                <dd>
                  {{ invoice.customer?.businessName }}
                  <div class="hint">
                    {{ invoice.customer?.documentType }} {{ invoice.customer?.documentNumber }}
                  </div>
                </dd>
                <dt>Correo</dt>
                <dd>{{ invoice.customer?.email || '—' }}</dd>
                <dt>Dirección</dt>
                <dd>{{ invoice.customer?.address || '—' }}</dd>
                <dt>Creada</dt>
                <dd>{{ formatDateTime(invoice.createdAt) }}</dd>
                <dt>Congelada</dt>
                <dd>{{ invoice.frozenAt ? formatDateTime(invoice.frozenAt) : 'No' }}</dd>
                <dt>Clave idempotencia</dt>
                <dd class="mono break">{{ invoice.idempotencyKey || '—' }}</dd>
                <dt>Autorización</dt>
                <dd class="mono break">
                  {{ invoice.authorizationCode || invoice.receptionCode || '—' }}
                </dd>
              </dl>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <div class="card-title"><h2>Contingencia</h2></div>
              <StatusBadge v-if="invoice.contingency" :status="invoice.contingency.status" />
            </header>
            <div class="card-body">
              <div v-if="invoice.contingency" class="section-stack" style="gap: 8px">
                <strong>{{ invoice.contingency.type }}</strong>
                <p class="hint">{{ invoice.contingency.description }}</p>
                <p class="hint">
                  Inicio: {{ formatDateTime(invoice.contingency.startedAt) }} ·
                  Fin: {{ formatDateTime(invoice.contingency.endedAt) }}
                </p>
                <RouterLink class="btn btn-ghost btn-sm" to="/contingencies">Ir a contingencias</RouterLink>
              </div>
              <div v-else-if="attachableContingencies.length" class="section-stack" style="gap: 10px">
                <p class="hint">Esta factura puede asociarse a un evento abierto del mismo emisor.</p>
                <select v-model="contingencyToAttach">
                  <option value="">Seleccione evento</option>
                  <option v-for="event in attachableContingencies" :key="event.id" :value="event.id">
                    {{ event.type }} · {{ event.id.slice(0, 8) }}
                  </option>
                </select>
                <button
                  class="btn btn-secondary btn-sm"
                  type="button"
                  :disabled="!contingencyToAttach || action !== ''"
                  @click="attachContingency"
                >
                  Asociar factura
                </button>
              </div>
              <p v-else class="hint">Sin eventos de contingencia abiertos para este emisor.</p>
            </div>
          </section>

          <section class="card">
            <header class="card-header">
              <div class="card-title"><h2>Anulaciones</h2><p>{{ cancellations.length }} solicitud(es)</p></div>
            </header>
            <div class="card-body section-stack" style="gap: 12px">
              <div v-if="canRequestCancellation" class="section-stack" style="gap: 8px">
                <label class="field-label" for="cancel-reason">Motivo de anulación</label>
                <textarea
                  id="cancel-reason"
                  v-model="cancellationReason"
                  maxlength="2000"
                  placeholder="Mínimo 10 caracteres. Se procesará con el proveedor simulado."
                />
                <button
                  class="btn btn-danger btn-sm"
                  type="button"
                  :disabled="action !== ''"
                  @click="requestCancellation"
                >
                  <span v-if="action === 'cancel'" class="spinner" />
                  Solicitar anulación
                </button>
              </div>

              <div v-if="cancellations.length === 0" class="empty" style="padding: 16px">
                Sin solicitudes de anulación.
              </div>
              <div v-for="request in cancellations" :key="request.id" class="card" style="box-shadow: none">
                <div class="card-body" style="padding: 14px">
                  <div class="row" style="justify-content: space-between">
                    <StatusBadge :status="request.status" />
                    <span class="hint">{{ formatDateTime(request.requestedAt) }}</span>
                  </div>
                  <p style="margin-top: 8px; font-size: 12.5px">{{ request.reason }}</p>
                  <p v-if="request.responseMessage" class="hint" style="margin-top: 4px">
                    {{ request.responseCode }} · {{ request.responseMessage }}
                  </p>
                  <button
                    v-if="admin && request.status === 'APROBADA'"
                    class="btn btn-secondary btn-sm"
                    style="margin-top: 8px"
                    type="button"
                    @click="openReverse(request)"
                  >
                    Revertir anulación
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="card">
            <header class="card-header"><div class="card-title"><h2>Depuración</h2></div></header>
            <div class="card-body">
              <JsonBlock :value="invoice" title="Factura completa (JSON)" />
            </div>
          </section>
        </div>
      </div>
    </template>

    <AppModal
      :open="reverseOpen"
      title="Revertir anulación"
      subtitle="Solo ADMIN. La factura volverá a estado AUTORIZADA."
      @close="reverseOpen = false"
    >
      <div class="field">
        <label for="reverse-reason">Motivo</label>
        <textarea
          id="reverse-reason"
          v-model="reverseReason"
          maxlength="2000"
          placeholder="Mínimo 10 caracteres"
        />
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="reverseOpen = false">Cancelar</button>
        <button class="btn btn-danger" type="button" :disabled="action !== ''" @click="confirmReverse">
          Confirmar reversión
        </button>
      </template>
    </AppModal>

    <div v-if="xml" style="display: none">{{ prettyJson(xml) }}</div>
  </div>
</template>
