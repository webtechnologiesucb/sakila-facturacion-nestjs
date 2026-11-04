<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import PaginationBar from '../components/PaginationBar.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage, type InvoiceListQuery } from '../lib/api';
import {
  documentTypeLabels,
  endOfDayIso,
  formatDateTime,
  formatMoney,
  invoiceStatusLabels,
  startOfDayIso,
} from '../lib/format';
import { notify } from '../lib/toast';
import type { DocumentType, Invoice, InvoiceStatus, Pagination } from '../types';

const invoices = ref<Invoice[]>([]);
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const error = ref('');

const filters = reactive({
  status: '' as InvoiceStatus | '',
  documentType: '' as DocumentType | '',
  from: '',
  to: '',
});

async function load(page = pagination.value.page): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const query: InvoiceListQuery = {
      page,
      limit: pagination.value.limit,
      status: filters.status,
      documentType: filters.documentType,
      from: startOfDayIso(filters.from),
      to: endOfDayIso(filters.to),
    };
    const result = await api.invoices.list(query);
    invoices.value = result.data;
    pagination.value = result.pagination;
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

function clearFilters(): void {
  filters.status = '';
  filters.documentType = '';
  filters.from = '';
  filters.to = '';
  void load(1);
}

function changePage(page: number): void {
  void load(page);
}

onMounted(() => load(1));
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Comprobantes fiscales</h2>
        <p class="hint">Filtre por estado, tipo de documento o rango de fechas.</p>
      </div>
      <div class="spacer" />
      <RouterLink class="btn btn-primary btn-sm" to="/invoices/new">+ Nueva factura</RouterLink>
    </div>

    <section class="card">
      <div class="card-body">
        <div class="filter-bar">
          <div class="field">
            <label for="status">Estado</label>
            <select id="status" v-model="filters.status">
              <option value="">Todos</option>
              <option v-for="(label, value) in invoiceStatusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="documentType">Documento</label>
            <select id="documentType" v-model="filters.documentType">
              <option value="">Todos</option>
              <option v-for="(label, value) in documentTypeLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="from">Desde</label>
            <input id="from" v-model="filters.from" type="date" />
          </div>
          <div class="field">
            <label for="to">Hasta</label>
            <input id="to" v-model="filters.to" type="date" />
          </div>
          <button class="btn btn-primary" type="button" @click="load(1)">Buscar</button>
          <button class="btn btn-secondary" type="button" @click="clearFilters">Limpiar</button>
        </div>
      </div>
    </section>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="card">
      <header class="card-header">
        <div class="card-title">
          <h2>Resultados</h2>
          <p>{{ pagination.total }} factura(s)</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="load()">↻ Recargar</button>
      </header>

      <div v-if="loading" class="loading-row"><span class="spinner" /> Consultando facturas…</div>

      <div v-else-if="invoices.length === 0" class="empty">
        <strong>No se encontraron facturas</strong>
        Ajuste los filtros o cree un nuevo comprobante.
      </div>

      <template v-else>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Emisión</th>
                <th>Tipo</th>
                <th class="num">Subtotal</th>
                <th class="num">Impuesto</th>
                <th class="num">Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in invoices" :key="invoice.id">
                <td>
                  <div class="mono">{{ invoice.serie }}-{{ invoice.number }}</div>
                  <div class="hint mono">{{ invoice.publicId }}</div>
                </td>
                <td>
                  <div>{{ invoice.customer?.businessName || '—' }}</div>
                  <div class="hint">{{ invoice.customer?.documentNumber || '' }}</div>
                </td>
                <td>{{ formatDateTime(invoice.issueDate) }}</td>
                <td>{{ documentTypeLabels[invoice.documentType] || invoice.documentType }}</td>
                <td class="num">{{ formatMoney(invoice.subtotal, invoice.currency) }}</td>
                <td class="num">{{ formatMoney(invoice.taxTotal, invoice.currency) }}</td>
                <td class="num"><strong>{{ formatMoney(invoice.total, invoice.currency) }}</strong></td>
                <td><StatusBadge :status="invoice.status" /></td>
                <td class="actions-cell">
                  <RouterLink class="btn btn-ghost btn-sm" :to="`/invoices/${invoice.id}`">
                    Ver
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <PaginationBar
          :page="pagination.page"
          :total-pages="pagination.totalPages"
          :total="pagination.total"
          :limit="pagination.limit"
          @update:page="changePage"
        />
      </template>
    </section>
  </div>
</template>
