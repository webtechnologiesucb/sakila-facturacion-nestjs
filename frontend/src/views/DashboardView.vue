<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage } from '../lib/api';
import {
  daysAgoInput,
  endOfDayIso,
  formatDateTime,
  formatMoney,
  invoiceStatusLabels,
  startOfDayIso,
  toDateInput,
} from '../lib/format';
import { notify } from '../lib/toast';
import type {
  Contingency,
  HealthResponse,
  Invoice,
  ReadyResponse,
  ReportSummary,
} from '../types';

const loading = ref(true);
const summary = ref<ReportSummary | null>(null);
const recent = ref<Invoice[]>([]);
const contingencies = ref<Contingency[]>([]);
const health = ref<HealthResponse | null>(null);
const ready = ref<ReadyResponse | null>(null);
const healthError = ref('');

const statusRows = computed(() =>
  [...(summary.value?.byStatus ?? [])].sort((a, b) => b.count - a.count),
);

const maxStatusCount = computed(() =>
  Math.max(1, ...statusRows.value.map((row) => row.count)),
);

function barWidth(count: number): string {
  return `${Math.max(4, Math.round((count / maxStatusCount.value) * 100))}%`;
}

async function load(): Promise<void> {
  loading.value = true;
  const from = startOfDayIso(daysAgoInput(30));
  const to = endOfDayIso(toDateInput());

  const [summaryResult, recentResult, contingencyResult, healthResult, readyResult] =
    await Promise.allSettled([
      api.reports.summary({ from, to }),
      api.invoices.list({ page: 1, limit: 5 }),
      api.contingencies.list({ status: 'ABIERTA' }),
      api.system.health(),
      api.system.ready(),
    ]);

  if (summaryResult.status === 'fulfilled') summary.value = summaryResult.value;
  else notify(errorMessage(summaryResult.reason), 'error');

  if (recentResult.status === 'fulfilled') recent.value = recentResult.value.data;
  if (contingencyResult.status === 'fulfilled') contingencies.value = contingencyResult.value;

  if (healthResult.status === 'fulfilled') health.value = healthResult.value;
  else healthError.value = errorMessage(healthResult.reason);

  if (readyResult.status === 'fulfilled') ready.value = readyResult.value;

  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Resumen de los últimos 30 días</h2>
        <p class="hint">Datos internos del entorno de demostración. No son libros fiscales oficiales.</p>
      </div>
      <div class="spacer" />
      <button class="btn btn-secondary btn-sm" type="button" @click="load">↻ Actualizar</button>
      <RouterLink class="btn btn-primary btn-sm" to="/invoices/new">+ Nueva factura</RouterLink>
    </div>

    <div v-if="loading" class="card">
      <div class="loading-row"><span class="spinner large" /> Cargando indicadores…</div>
    </div>

    <template v-else>
      <div class="grid grid-4">
        <article class="stat accent">
          <p class="stat-label">Facturas emitidas</p>
          <p class="stat-value">{{ summary?.allInvoices.count ?? 0 }}</p>
          <p class="stat-hint">Total en el rango consultado</p>
        </article>
        <article class="stat success">
          <p class="stat-label">Autorizadas</p>
          <p class="stat-value">{{ summary?.authorizedInvoices.count ?? 0 }}</p>
          <p class="stat-hint">Incluye anuladas y pendientes de anulación</p>
        </article>
        <article class="stat">
          <p class="stat-label">Monto autorizado</p>
          <p class="stat-value">{{ formatMoney(summary?.authorizedInvoices.total) }}</p>
          <p class="stat-hint">Subtotal + impuestos</p>
        </article>
        <article class="stat warning">
          <p class="stat-label">Impuestos</p>
          <p class="stat-value">{{ formatMoney(summary?.authorizedInvoices.taxTotal) }}</p>
          <p class="stat-hint">Calculados con reglas configurables</p>
        </article>
      </div>

      <div class="grid grid-2">
        <section class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Facturas por estado</h2>
              <p>Distribución del rango</p>
            </div>
          </header>
          <div class="card-body">
            <div v-if="statusRows.length === 0" class="empty">
              <strong>Sin facturas en el rango</strong>
              Cree una factura para comenzar.
            </div>
            <div v-else class="section-stack" style="gap: 12px">
              <div v-for="row in statusRows" :key="row.status" class="bar-row">
                <span>{{ invoiceStatusLabels[row.status] || row.status }}</span>
                <div class="meter">
                  <span
                    :style="{
                      width: barWidth(row.count),
                      background:
                        row.status === 'AUTORIZADA'
                          ? 'var(--success)'
                          : row.status === 'RECHAZADA' || row.status === 'ANULADA'
                            ? 'var(--danger)'
                            : row.status === 'EN_CONTINGENCIA'
                              ? 'var(--purple)'
                              : 'var(--brand)',
                    }"
                  />
                </div>
                <span class="hint">{{ row.count }} · {{ formatMoney(row.total) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Estado del sistema</h2>
              <p>Health y readiness de la API</p>
            </div>
            <RouterLink class="btn btn-ghost btn-sm" to="/system">Ver detalle</RouterLink>
          </header>
          <div class="card-body section-stack" style="gap: 12px">
            <div class="row" style="justify-content: space-between">
              <span class="inline">
                <span class="status-dot" :class="health?.status === 'ok' ? 'ok' : 'fail'" />
                Liveness
              </span>
              <strong>{{ health?.status === 'ok' ? 'OK' : healthError ? 'Sin conexión' : '—' }}</strong>
            </div>
            <div class="row" style="justify-content: space-between">
              <span class="inline">
                <span class="status-dot" :class="ready?.ready ? 'ok' : 'fail'" />
                Readiness
              </span>
              <strong>{{ ready?.ready ? 'Listo' : 'No disponible' }}</strong>
            </div>
            <div class="row" style="justify-content: space-between">
              <span>Base de datos</span>
              <strong>{{ ready?.database || '—' }}</strong>
            </div>
            <div class="row" style="justify-content: space-between">
              <span>Contingencias abiertas</span>
              <strong>{{ contingencies.length }}</strong>
            </div>
            <div class="alert alert-warning" style="margin-top: 4px">
              Emisor y configuración simulados. Las tasas y catálogos requieren validación normativa.
            </div>
          </div>
        </section>
      </div>

      <section class="card">
        <header class="card-header">
          <div class="card-title">
            <h2>Facturas recientes</h2>
            <p>Últimos comprobantes creados</p>
          </div>
          <RouterLink class="btn btn-secondary btn-sm" to="/invoices">Ver todas</RouterLink>
        </header>
        <div v-if="recent.length === 0" class="empty">
          <strong>Aún no hay facturas</strong>
          Cree la primera desde el botón «Nueva factura».
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Comprobante</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th class="num">Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in recent" :key="invoice.id">
                <td>
                  <div class="mono">{{ invoice.serie }}-{{ invoice.number }}</div>
                  <div class="hint mono">{{ invoice.publicId }}</div>
                </td>
                <td>{{ invoice.customer?.businessName || '—' }}</td>
                <td>{{ formatDateTime(invoice.issueDate) }}</td>
                <td class="num">{{ formatMoney(invoice.total, invoice.currency) }}</td>
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
      </section>

      <section class="card">
        <header class="card-header">
          <div class="card-title">
            <h2>Accesos rápidos</h2>
            <p>Flujos principales de prueba</p>
          </div>
        </header>
        <div class="card-body grid grid-4">
          <RouterLink class="card" style="padding: 16px" to="/invoices/new">
            <strong>Crear factura</strong>
            <p class="hint" style="margin-top: 4px">Borrador con ítems y cálculo automático.</p>
          </RouterLink>
          <RouterLink class="card" style="padding: 16px" to="/configuration">
            <strong>Configurar emisor</strong>
            <p class="hint" style="margin-top: 4px">Sucursales, puntos de venta y reglas.</p>
          </RouterLink>
          <RouterLink class="card" style="padding: 16px" to="/reports">
            <strong>Consultar reportes</strong>
            <p class="hint" style="margin-top: 4px">Resumen, tasas, clientes y ventas diarias.</p>
          </RouterLink>
          <RouterLink class="card" style="padding: 16px" to="/system">
            <strong>Diagnóstico API</strong>
            <p class="hint" style="margin-top: 4px">Health, readiness y datos de sesión.</p>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>
