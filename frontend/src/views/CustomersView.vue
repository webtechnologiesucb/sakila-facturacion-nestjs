<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppModal from '../components/AppModal.vue';
import JsonBlock from '../components/JsonBlock.vue';
import PaginationBar from '../components/PaginationBar.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage, type CreateCustomerPayload } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { canWrite } from '../lib/session';
import { notify } from '../lib/toast';
import type { Customer, Pagination } from '../types';

const customers = ref<Customer[]>([]);
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const error = ref('');
const search = ref('');
const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<Customer | null>(null);
const selected = ref<Customer | null>(null);

const writable = computed(() => canWrite());

const form = reactive({
  documentType: 'NIT',
  documentNumber: '',
  businessName: '',
  email: '',
  phone: '',
  address: '',
  taxpayerType: 'EMPRESA',
  sakilaCustomerId: '',
  active: true,
});

function resetForm(): void {
  form.documentType = 'NIT';
  form.documentNumber = '';
  form.businessName = '';
  form.email = '';
  form.phone = '';
  form.address = '';
  form.taxpayerType = 'EMPRESA';
  form.sakilaCustomerId = '';
  form.active = true;
}

function openCreate(): void {
  editing.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEdit(customer: Customer): void {
  editing.value = customer;
  form.documentType = customer.documentType;
  form.documentNumber = customer.documentNumber;
  form.businessName = customer.businessName;
  form.email = customer.email || '';
  form.phone = customer.phone || '';
  form.address = customer.address || '';
  form.taxpayerType = customer.taxpayerType || '';
  form.sakilaCustomerId = customer.sakilaCustomerId ? String(customer.sakilaCustomerId) : '';
  form.active = customer.active;
  modalOpen.value = true;
}

async function load(page = pagination.value.page): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await api.customers.list({
      page,
      limit: pagination.value.limit,
      search: search.value.trim() || undefined,
    });
    customers.value = result.data;
    pagination.value = result.pagination;
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (!form.documentNumber.trim() || !form.businessName.trim()) {
    notify('Documento y razón social son obligatorios.', 'warning');
    return;
  }
  const payload: CreateCustomerPayload = {
    documentType: form.documentType.trim(),
    documentNumber: form.documentNumber.trim(),
    businessName: form.businessName.trim(),
    active: form.active,
  };
  if (form.email.trim()) payload.email = form.email.trim();
  if (form.phone.trim()) payload.phone = form.phone.trim();
  if (form.address.trim()) payload.address = form.address.trim();
  if (form.taxpayerType.trim()) payload.taxpayerType = form.taxpayerType.trim();
  if (form.sakilaCustomerId.trim()) payload.sakilaCustomerId = Number(form.sakilaCustomerId);

  saving.value = true;
  try {
    if (editing.value) {
      await api.customers.update(editing.value.id, payload);
      notify('Cliente actualizado.', 'success');
    } else {
      await api.customers.create(payload);
      notify('Cliente fiscal creado.', 'success');
    }
    modalOpen.value = false;
    await load(editing.value ? pagination.value.page : 1);
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleActive(customer: Customer): Promise<void> {
  try {
    await api.customers.update(customer.id, { active: !customer.active });
    notify(`Cliente ${customer.active ? 'desactivado' : 'activado'}.`, 'success');
    await load();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  }
}

onMounted(() => load(1));
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Clientes fiscales</h2>
        <p class="hint">Datos propios del documento fiscal; no se reutilizan pagos ni alquileres Sakila.</p>
      </div>
      <div class="spacer" />
      <button v-if="writable" class="btn btn-primary btn-sm" type="button" @click="openCreate">
        + Nuevo cliente
      </button>
    </div>

    <section class="card">
      <div class="card-body">
        <div class="filter-bar">
          <div class="field grow">
            <label for="customer-search">Buscar</label>
            <input
              id="customer-search"
              v-model="search"
              placeholder="Razón social o número de documento"
              @keyup.enter="load(1)"
            />
          </div>
          <button class="btn btn-primary" type="button" @click="load(1)">Buscar</button>
          <button class="btn btn-secondary" type="button" @click="search = ''; load(1)">Limpiar</button>
        </div>
      </div>
    </section>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="card">
      <header class="card-header">
        <div class="card-title">
          <h2>Clientes registrados</h2>
          <p>{{ pagination.total }} registro(s)</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="load()">↻ Recargar</button>
      </header>

      <div v-if="loading" class="loading-row"><span class="spinner" /> Consultando clientes…</div>
      <div v-else-if="customers.length === 0" class="empty">
        <strong>No hay clientes para mostrar</strong>
        Cree un cliente fiscal para poder facturar.
      </div>

      <template v-else>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Razón social</th>
                <th>Contacto</th>
                <th>Tipo contribuyente</th>
                <th>Sakila</th>
                <th>Estado</th>
                <th>Creado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="customer in customers" :key="customer.id">
                <td>
                  <div class="mono">{{ customer.documentType }} {{ customer.documentNumber }}</div>
                  <div class="hint mono">{{ customer.id.slice(0, 8) }}</div>
                </td>
                <td>
                  <div>{{ customer.businessName }}</div>
                  <div class="hint">{{ customer.address || 'Sin dirección' }}</div>
                </td>
                <td>
                  <div class="hint">{{ customer.email || '—' }}</div>
                  <div class="hint">{{ customer.phone || '—' }}</div>
                </td>
                <td>{{ customer.taxpayerType || '—' }}</td>
                <td class="mono">{{ customer.sakilaCustomerId ?? '—' }}</td>
                <td>
                  <StatusBadge
                    :status="customer.active ? 'ACTIVO' : 'INACTIVO'"
                    :tone="customer.active ? 'success' : 'neutral'"
                  />
                </td>
                <td class="hint">{{ formatDateTime(customer.createdAt) }}</td>
                <td class="actions-cell">
                  <button class="link-button" type="button" @click="selected = customer">Ver</button>
                  <button v-if="writable" class="link-button" type="button" @click="openEdit(customer)">
                    Editar
                  </button>
                  <button v-if="writable" class="link-button" type="button" @click="toggleActive(customer)">
                    {{ customer.active ? 'Desactivar' : 'Activar' }}
                  </button>
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
          @update:page="load"
        />
      </template>
    </section>

    <AppModal
      :open="modalOpen"
      :title="editing ? 'Editar cliente fiscal' : 'Nuevo cliente fiscal'"
      subtitle="El documento es interno y no pertenece a un catálogo oficial."
      @close="modalOpen = false"
    >
      <div class="form-grid">
        <div class="field">
          <label for="doc-type">Tipo de documento</label>
          <select id="doc-type" v-model="form.documentType">
            <option value="NIT">NIT</option>
            <option value="CI">CI</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div class="field">
          <label for="doc-number">Número de documento</label>
          <input id="doc-number" v-model="form.documentNumber" maxlength="30" placeholder="9876543210" />
        </div>
        <div class="field span-full">
          <label for="business-name">Razón social</label>
          <input id="business-name" v-model="form.businessName" maxlength="250" />
        </div>
        <div class="field">
          <label for="customer-email">Correo</label>
          <input id="customer-email" v-model="form.email" type="email" maxlength="120" />
        </div>
        <div class="field">
          <label for="customer-phone">Teléfono</label>
          <input id="customer-phone" v-model="form.phone" maxlength="40" />
        </div>
        <div class="field span-full">
          <label for="customer-address">Dirección</label>
          <input id="customer-address" v-model="form.address" maxlength="500" />
        </div>
        <div class="field">
          <label for="taxpayer-type">Tipo contribuyente</label>
          <input id="taxpayer-type" v-model="form.taxpayerType" maxlength="30" />
        </div>
        <div class="field">
          <label for="sakila-id">ID cliente Sakila (opcional)</label>
          <input id="sakila-id" v-model="form.sakilaCustomerId" type="number" min="1" />
        </div>
        <div class="field span-full">
          <div class="checkbox-row">
            <input id="customer-active" v-model="form.active" type="checkbox" />
            <label for="customer-active">Cliente activo</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="save">
          <span v-if="saving" class="spinner" />
          {{ editing ? 'Guardar cambios' : 'Crear cliente' }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="selected !== null"
      title="Cliente fiscal"
      :subtitle="selected?.id"
      wide
      @close="selected = null"
    >
      <div v-if="selected">
        <dl class="kv">
          <dt>Documento</dt><dd>{{ selected.documentType }} {{ selected.documentNumber }}</dd>
          <dt>Razón social</dt><dd>{{ selected.businessName }}</dd>
          <dt>Correo</dt><dd>{{ selected.email || '—' }}</dd>
          <dt>Teléfono</dt><dd>{{ selected.phone || '—' }}</dd>
          <dt>Dirección</dt><dd>{{ selected.address || '—' }}</dd>
          <dt>Tipo contribuyente</dt><dd>{{ selected.taxpayerType || '—' }}</dd>
          <dt>Cliente Sakila</dt><dd>{{ selected.sakilaCustomerId ?? '—' }}</dd>
          <dt>Estado</dt><dd>{{ selected.active ? 'Activo' : 'Inactivo' }}</dd>
        </dl>
        <div class="divider" />
        <JsonBlock :value="selected" title="Respuesta JSON" />
      </div>
    </AppModal>
  </div>
</template>
