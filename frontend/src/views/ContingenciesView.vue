<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppModal from '../components/AppModal.vue';
import JsonBlock from '../components/JsonBlock.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage } from '../lib/api';
import {
  contingencyStatusLabels,
  formatDateTime,
  formatMoney,
} from '../lib/format';
import { canWrite } from '../lib/session';
import { notify } from '../lib/toast';
import type { Contingency, ContingencyStatus, Issuer } from '../types';

const contingencies = ref<Contingency[]>([]);
const issuers = ref<Issuer[]>([]);
const loading = ref(false);
const error = ref('');
const statusFilter = ref<ContingencyStatus | ''>('');
const issuerFilter = ref('');
const writable = computed(() => canWrite());

const createModal = ref(false);
const creating = ref(false);
const createForm = reactive({
  issuerId: '',
  type: 'CORTE_DE_INTERNET',
  description: '',
});

const detail = ref<Contingency | null>(null);
const detailLoading = ref(false);
const action = ref('');

const closeModal = ref(false);
const closeForm = reactive({ endedAt: '' });

const reportModal = ref(false);
const reportForm = reactive({ eventCode: '' });

const attachForm = reactive({ invoiceId: '' });

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [list, issuerList] = await Promise.all([
      api.contingencies.list({
        status: statusFilter.value,
        issuerId: issuerFilter.value || undefined,
      }),
      api.issuers.list(),
    ]);
    contingencies.value = list;
    issuers.value = issuerList;
    if (!createForm.issuerId) createForm.issuerId = issuerList[0]?.id ?? '';
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  createForm.issuerId = issuers.value[0]?.id ?? '';
  createForm.type = 'CORTE_DE_INTERNET';
  createForm.description = '';
  createModal.value = true;
}

async function create(): Promise<void> {
  if (!createForm.issuerId) {
    notify('Seleccione un emisor.', 'warning');
    return;
  }
  if (createForm.description.trim().length < 10) {
    notify('La descripción debe tener al menos 10 caracteres.', 'warning');
    return;
  }
  creating.value = true;
  try {
    const created = await api.contingencies.create({
      issuerId: createForm.issuerId,
      type: createForm.type.trim(),
      description: createForm.description.trim(),
    });
    notify('Evento de contingencia abierto.', 'success');
    createModal.value = false;
    await load();
    await openDetail(created);
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    creating.value = false;
  }
}

async function openDetail(event: Contingency): Promise<void> {
  detailLoading.value = true;
  detail.value = event;
  try {
    detail.value = await api.contingencies.get(event.id);
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    detailLoading.value = false;
  }
}

function openClose(): void {
  closeForm.endedAt = '';
  closeModal.value = true;
}

async function closeEvent(): Promise<void> {
  if (!detail.value) return;
  action.value = 'close';
  try {
    detail.value = await api.contingencies.close(
      detail.value.id,
      closeForm.endedAt ? new Date(closeForm.endedAt).toISOString() : undefined,
    );
    notify('Evento de contingencia cerrado.', 'success');
    closeModal.value = false;
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

function openReport(): void {
  reportForm.eventCode = '';
  reportModal.value = true;
}

async function reportEvent(): Promise<void> {
  if (!detail.value) return;
  action.value = 'report';
  try {
    detail.value = await api.contingencies.report(
      detail.value.id,
      reportForm.eventCode.trim() || undefined,
    );
    notify('Evento regularizado (simulado).', 'success');
    reportModal.value = false;
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    action.value = '';
  }
}

async function attachInvoice(): Promise<void> {
  if (!detail.value || !attachForm.invoiceId.trim()) return;
  action.value = 'attach';
  try {
    detail.value = await api.contingencies.attachInvoice(
      detail.value.id,
      attachForm.invoiceId.trim(),
    );
    notify('Factura asociada al evento.', 'success');
    attachForm.invoiceId = '';
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
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Contingencias</h2>
        <p class="hint">Eventos que permiten emitir y regularizar facturas fuera de línea (simulado).</p>
      </div>
      <div class="spacer" />
      <button v-if="writable" class="btn btn-primary btn-sm" type="button" @click="openCreate">
        + Abrir contingencia
      </button>
    </div>

    <section class="card">
      <div class="card-body">
        <div class="filter-bar">
          <div class="field grow">
            <label for="c-issuer">Emisor</label>
            <select id="c-issuer" v-model="issuerFilter" @change="load">
              <option value="">Todos</option>
              <option v-for="issuer in issuers" :key="issuer.id" :value="issuer.id">
                {{ issuer.legalName }} · {{ issuer.nit }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="c-status">Estado</label>
            <select id="c-status" v-model="statusFilter" @change="load">
              <option value="">Todos</option>
              <option v-for="(label, value) in contingencyStatusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <button class="btn btn-primary" type="button" @click="load">Buscar</button>
          <button class="btn btn-secondary" type="button" @click="issuerFilter = ''; statusFilter = ''; load()">
            Limpiar
          </button>
        </div>
      </div>
    </section>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="card">
      <header class="card-header">
        <div class="card-title"><h2>Eventos registrados</h2><p>{{ contingencies.length }} evento(s)</p></div>
        <button class="btn btn-ghost btn-sm" type="button" @click="load">↻ Recargar</button>
      </header>

      <div v-if="loading" class="loading-row"><span class="spinner" /> Consultando contingencias…</div>
      <div v-else-if="contingencies.length === 0" class="empty">
        <strong>Sin eventos de contingencia</strong>
        Abra un evento cuando exista una interrupción operativa.
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Emisor</th>
              <th>Descripción</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th class="num">Facturas</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in contingencies" :key="event.id">
              <td class="mono">{{ event.type }}</td>
              <td>{{ event.issuer?.legalName || '—' }}</td>
              <td class="hint" style="max-width: 320px">{{ event.description }}</td>
              <td>{{ formatDateTime(event.startedAt) }}</td>
              <td>{{ formatDateTime(event.endedAt) }}</td>
              <td class="num">{{ event._count?.invoices ?? event.invoices?.length ?? 0 }}</td>
              <td><StatusBadge :status="event.status" /></td>
              <td class="actions-cell">
                <button class="link-button" type="button" @click="openDetail(event)">Ver detalle</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal :open="createModal" title="Abrir evento de contingencia" @close="createModal = false">
      <div class="form-grid">
        <div class="field span-full">
          <label for="new-issuer">Emisor</label>
          <select id="new-issuer" v-model="createForm.issuerId">
            <option value="" disabled>Seleccione emisor</option>
            <option v-for="issuer in issuers" :key="issuer.id" :value="issuer.id">
              {{ issuer.legalName }} · {{ issuer.nit }}
            </option>
          </select>
        </div>
        <div class="field span-full">
          <label for="new-type">Tipo de evento</label>
          <input id="new-type" v-model="createForm.type" maxlength="80" placeholder="CORTE_DE_INTERNET" />
        </div>
        <div class="field span-full">
          <label for="new-description">Descripción</label>
          <textarea
            id="new-description"
            v-model="createForm.description"
            maxlength="2000"
            placeholder="Mínimo 10 caracteres"
          />
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="createModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="creating" @click="create">
          <span v-if="creating" class="spinner" />
          Abrir evento
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="detail !== null"
      title="Detalle de contingencia"
      :subtitle="detail?.id"
      wide
      @close="detail = null"
    >
      <div v-if="detailLoading" class="loading-row"><span class="spinner" /> Cargando detalle…</div>
      <div v-else-if="detail" class="section-stack">
        <div class="row">
          <div>
            <div class="row">
              <strong class="mono">{{ detail.type }}</strong>
              <StatusBadge :status="detail.status" />
            </div>
            <p class="hint" style="margin-top: 4px">{{ detail.description }}</p>
          </div>
          <div class="spacer" />
          <div class="page-actions">
            <button
              v-if="writable && detail.status === 'ABIERTA'"
              class="btn btn-secondary btn-sm"
              type="button"
              :disabled="action !== ''"
              @click="openClose"
            >
              Cerrar evento
            </button>
            <button
              v-if="writable && detail.status !== 'REGULARIZADA'"
              class="btn btn-primary btn-sm"
              type="button"
              :disabled="action !== ''"
              @click="openReport"
            >
              Regularizar
            </button>
          </div>
        </div>

        <dl class="kv">
          <dt>Emisor</dt><dd>{{ detail.issuer?.legalName || '—' }} · {{ detail.issuer?.nit || '' }}</dd>
          <dt>Inicio</dt><dd>{{ formatDateTime(detail.startedAt) }}</dd>
          <dt>Fin</dt><dd>{{ formatDateTime(detail.endedAt) }}</dd>
          <dt>Reportado</dt><dd>{{ formatDateTime(detail.reportedAt) }}</dd>
          <dt>Código de evento</dt><dd class="mono">{{ detail.eventCode || '—' }}</dd>
        </dl>

        <div v-if="writable && detail.status === 'ABIERTA'" class="card" style="box-shadow: none">
          <div class="card-body">
            <strong>Asociar factura existente</strong>
            <p class="hint" style="margin: 4px 0 10px">
              Pegue el UUID de una factura del mismo emisor.
            </p>
            <div class="row" style="flex-wrap: nowrap">
              <input v-model="attachForm.invoiceId" class="mono" placeholder="UUID de factura" />
              <button
                class="btn btn-secondary"
                type="button"
                :disabled="!attachForm.invoiceId.trim() || action !== ''"
                @click="attachInvoice"
              >
                Asociar
              </button>
            </div>
          </div>
        </div>

        <div>
          <strong>Facturas asociadas ({{ detail.invoices?.length ?? 0 }})</strong>
          <div v-if="!detail.invoices?.length" class="empty" style="padding: 18px">
            Sin facturas asociadas a este evento.
          </div>
          <div v-else class="table-wrap card" style="box-shadow: none; margin-top: 8px">
            <table>
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Fecha</th>
                  <th class="num">Total</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="invoice in detail.invoices" :key="invoice.id">
                  <td class="mono">{{ invoice.publicId }}</td>
                  <td>{{ formatDateTime(invoice.issueDate) }}</td>
                  <td class="num">{{ formatMoney(invoice.total) }}</td>
                  <td><StatusBadge :status="invoice.status" /></td>
                  <td class="actions-cell">
                    <RouterLink class="link-button" :to="`/invoices/${invoice.id}`">Abrir</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <JsonBlock :value="detail" title="Respuesta JSON" />
      </div>
    </AppModal>

    <AppModal :open="closeModal" title="Cerrar contingencia" @close="closeModal = false">
      <div class="field">
        <label for="close-ended">Fecha de fin (opcional)</label>
        <input id="close-ended" v-model="closeForm.endedAt" type="datetime-local" />
        <small>Si se omite, la API usa la fecha actual.</small>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="closeModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="action !== ''" @click="closeEvent">
          Confirmar cierre
        </button>
      </template>
    </AppModal>

    <AppModal :open="reportModal" title="Regularizar contingencia" @close="reportModal = false">
      <div class="field">
        <label for="report-code">Código de evento del proveedor (opcional)</label>
        <input id="report-code" v-model="reportForm.eventCode" maxlength="80" placeholder="EVT-2026-001" />
        <small>La regularización es simulada y no envía datos reales al SIN.</small>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="reportModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="action !== ''" @click="reportEvent">
          Regularizar
        </button>
      </template>
    </AppModal>
  </div>
</template>
