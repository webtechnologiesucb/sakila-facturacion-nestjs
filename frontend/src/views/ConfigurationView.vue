<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppModal from '../components/AppModal.vue';
import JsonBlock from '../components/JsonBlock.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage } from '../lib/api';
import {
  environmentLabels,
  modalityLabels,
  validationLabels,
} from '../lib/format';
import { isAdmin } from '../lib/session';
import { notify } from '../lib/toast';
import type {
  Branch,
  Issuer,
  PointOfSale,
  TaxConfiguration,
  TaxEnvironment,
  TaxModality,
  TaxRule,
  ValidationStatus,
} from '../types';

type Tab = 'issuers' | 'branches' | 'pos' | 'configs';

const tab = ref<Tab>('issuers');
const admin = computed(() => isAdmin());

const issuers = ref<Issuer[]>([]);
const configurations = ref<TaxConfiguration[]>([]);
const rules = ref<TaxRule[]>([]);
const loading = ref(true);
const error = ref('');

const selectedIssuerId = ref('');
const selectedBranchId = ref('');
const selectedConfigId = ref('');

const selectedIssuer = computed(() => issuers.value.find((issuer) => issuer.id === selectedIssuerId.value) ?? null);
const branches = computed(() => selectedIssuer.value?.branches ?? []);
const selectedBranch = computed(() => branches.value.find((branch) => branch.id === selectedBranchId.value) ?? null);
const pointsOfSale = computed(() => selectedBranch.value?.pointsOfSale ?? []);
const issuerConfigurations = computed(() =>
  configurations.value.filter((configuration) => configuration.issuerId === selectedIssuerId.value),
);
const selectedConfiguration = computed(
  () => configurations.value.find((configuration) => configuration.id === selectedConfigId.value) ?? null,
);

/* ----------------------------- Emisor ------------------------------------ */

const issuerModal = ref(false);
const issuerSaving = ref(false);
const editingIssuer = ref<Issuer | null>(null);
const issuerForm = reactive({
  nit: '',
  legalName: '',
  businessName: '',
  economicActivityCode: '',
  address: '',
  phone: '',
  email: '',
  active: true,
});

function resetIssuerForm(): void {
  issuerForm.nit = '';
  issuerForm.legalName = '';
  issuerForm.businessName = '';
  issuerForm.economicActivityCode = '';
  issuerForm.address = '';
  issuerForm.phone = '';
  issuerForm.email = '';
  issuerForm.active = true;
}

function openIssuerCreate(): void {
  editingIssuer.value = null;
  resetIssuerForm();
  issuerModal.value = true;
}

function openIssuerEdit(issuer: Issuer): void {
  editingIssuer.value = issuer;
  issuerForm.nit = issuer.nit;
  issuerForm.legalName = issuer.legalName;
  issuerForm.businessName = issuer.businessName || '';
  issuerForm.economicActivityCode = issuer.economicActivityCode || '';
  issuerForm.address = issuer.address;
  issuerForm.phone = issuer.phone || '';
  issuerForm.email = issuer.email || '';
  issuerForm.active = issuer.active;
  issuerModal.value = true;
}

async function saveIssuer(): Promise<void> {
  if (!issuerForm.nit.trim() || !issuerForm.legalName.trim() || !issuerForm.address.trim()) {
    notify('NIT, razón social y dirección son obligatorios.', 'warning');
    return;
  }
  const payload: Record<string, unknown> = {
    nit: issuerForm.nit.trim(),
    legalName: issuerForm.legalName.trim(),
    address: issuerForm.address.trim(),
    active: issuerForm.active,
  };
  if (issuerForm.businessName.trim()) payload.businessName = issuerForm.businessName.trim();
  if (issuerForm.economicActivityCode.trim()) {
    payload.economicActivityCode = issuerForm.economicActivityCode.trim();
  }
  if (issuerForm.phone.trim()) payload.phone = issuerForm.phone.trim();
  if (issuerForm.email.trim()) payload.email = issuerForm.email.trim();

  issuerSaving.value = true;
  try {
    if (editingIssuer.value) {
      await api.issuers.update(editingIssuer.value.id, payload);
      notify('Emisor actualizado.', 'success');
    } else {
      const created = await api.issuers.create(payload);
      notify('Emisor creado.', 'success');
      selectedIssuerId.value = created.id;
    }
    issuerModal.value = false;
    await reload();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    issuerSaving.value = false;
  }
}

/* ---------------------------- Sucursal ----------------------------------- */

const branchModal = ref(false);
const branchSaving = ref(false);
const editingBranch = ref<Branch | null>(null);
const branchForm = reactive({
  code: '',
  name: '',
  address: '',
  municipality: '',
  active: true,
});

function openBranchCreate(): void {
  editingBranch.value = null;
  branchForm.code = '';
  branchForm.name = '';
  branchForm.address = selectedIssuer.value?.address || '';
  branchForm.municipality = '';
  branchForm.active = true;
  branchModal.value = true;
}

function openBranchEdit(branch: Branch): void {
  editingBranch.value = branch;
  branchForm.code = branch.code;
  branchForm.name = branch.name;
  branchForm.address = branch.address;
  branchForm.municipality = branch.municipality || '';
  branchForm.active = branch.active;
  branchModal.value = true;
}

async function saveBranch(): Promise<void> {
  if (!selectedIssuerId.value) {
    notify('Seleccione un emisor.', 'warning');
    return;
  }
  if (!branchForm.code.trim() || !branchForm.name.trim() || !branchForm.address.trim()) {
    notify('Código, nombre y dirección son obligatorios.', 'warning');
    return;
  }
  const payload: Record<string, unknown> = {
    code: branchForm.code.trim(),
    name: branchForm.name.trim(),
    address: branchForm.address.trim(),
    active: branchForm.active,
  };
  if (branchForm.municipality.trim()) payload.municipality = branchForm.municipality.trim();

  branchSaving.value = true;
  try {
    if (editingBranch.value) {
      await api.issuers.updateBranch(editingBranch.value.id, payload);
      notify('Sucursal actualizada.', 'success');
    } else {
      const created = await api.issuers.createBranch(selectedIssuerId.value, payload);
      notify('Sucursal creada.', 'success');
      selectedBranchId.value = created.id;
    }
    branchModal.value = false;
    await reload();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    branchSaving.value = false;
  }
}

/* ------------------------- Punto de venta -------------------------------- */

const posModal = ref(false);
const posSaving = ref(false);
const editingPos = ref<PointOfSale | null>(null);
const posForm = reactive({ code: '', name: '', active: true });

function openPosCreate(): void {
  editingPos.value = null;
  posForm.code = '';
  posForm.name = '';
  posForm.active = true;
  posModal.value = true;
}

function openPosEdit(pos: PointOfSale): void {
  editingPos.value = pos;
  posForm.code = pos.code;
  posForm.name = pos.name;
  posForm.active = pos.active;
  posModal.value = true;
}

async function savePos(): Promise<void> {
  if (!selectedBranchId.value) {
    notify('Seleccione una sucursal.', 'warning');
    return;
  }
  if (!posForm.code.trim() || !posForm.name.trim()) {
    notify('Código y nombre son obligatorios.', 'warning');
    return;
  }
  const payload: Record<string, unknown> = {
    code: posForm.code.trim(),
    name: posForm.name.trim(),
    active: posForm.active,
  };
  posSaving.value = true;
  try {
    if (editingPos.value) {
      await api.issuers.updatePointOfSale(editingPos.value.id, payload);
      notify('Punto de venta actualizado.', 'success');
    } else {
      await api.issuers.createPointOfSale(selectedBranchId.value, payload);
      notify('Punto de venta creado.', 'success');
    }
    posModal.value = false;
    await reload();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    posSaving.value = false;
  }
}

/* ---------------------- Configuración y reglas --------------------------- */

const configModal = ref(false);
const configSaving = ref(false);
const editingConfig = ref<TaxConfiguration | null>(null);
const configForm = reactive({
  name: '',
  version: '1',
  environment: 'SIMULATED' as TaxEnvironment,
  modality: 'ELECTRONICA_EN_LINEA' as TaxModality,
  currency: 'BOB',
  priceIncludesTax: false,
  defaultTaxRate: '0.130000',
  roundingMode: 'ROUND_HALF_UP',
  effectiveFrom: '',
  effectiveTo: '',
  sourceReference: '',
  validationStatus: 'PENDING_VERIFICATION' as ValidationStatus,
  verifiedBy: '',
  notes: '',
  active: true,
});

const ruleModal = ref(false);
const ruleSaving = ref(false);
const editingRule = ref<TaxRule | null>(null);
const ruleForm = reactive({
  code: 'IVA',
  name: 'Impuesto al Valor Agregado (demo)',
  taxType: 'IVA',
  rate: '0.130000',
  sourceReference: '',
  validationStatus: 'PENDING_VERIFICATION' as ValidationStatus,
});

const ruleSource = ref<TaxConfiguration | null>(null);

function openConfigCreate(): void {
  editingConfig.value = null;
  configForm.name = '';
  configForm.version = String(issuerConfigurations.value.length + 1);
  configForm.environment = 'SIMULATED';
  configForm.modality = 'ELECTRONICA_EN_LINEA';
  configForm.currency = 'BOB';
  configForm.priceIncludesTax = false;
  configForm.defaultTaxRate = '0.130000';
  configForm.roundingMode = 'ROUND_HALF_UP';
  configForm.effectiveFrom = '';
  configForm.effectiveTo = '';
  configForm.sourceReference = 'Configuración interna de demostración. Verificar normativa vigente.';
  configForm.validationStatus = 'PENDING_VERIFICATION';
  configForm.verifiedBy = '';
  configForm.notes = '';
  configForm.active = true;
  configModal.value = true;
}

function openConfigEdit(configuration: TaxConfiguration): void {
  editingConfig.value = configuration;
  configForm.name = configuration.name;
  configForm.version = String(configuration.version);
  configForm.environment = configuration.environment;
  configForm.modality = configuration.modality;
  configForm.currency = configuration.currency;
  configForm.priceIncludesTax = configuration.priceIncludesTax;
  configForm.defaultTaxRate = configuration.defaultTaxRate;
  configForm.roundingMode = configuration.roundingMode;
  configForm.effectiveFrom = configuration.effectiveFrom
    ? configuration.effectiveFrom.slice(0, 16)
    : '';
  configForm.effectiveTo = configuration.effectiveTo ? configuration.effectiveTo.slice(0, 16) : '';
  configForm.sourceReference = configuration.sourceReference;
  configForm.validationStatus = configuration.validationStatus;
  configForm.verifiedBy = configuration.verifiedBy || '';
  configForm.notes = configuration.notes || '';
  configForm.active = configuration.active;
  configModal.value = true;
}

async function saveConfig(): Promise<void> {
  if (!selectedIssuerId.value) {
    notify('Seleccione un emisor.', 'warning');
    return;
  }
  if (!configForm.name.trim() || !configForm.sourceReference.trim()) {
    notify('Nombre y fuente de referencia son obligatorios.', 'warning');
    return;
  }
  const payload: Record<string, unknown> = {
    issuerId: selectedIssuerId.value,
    name: configForm.name.trim(),
    version: Number(configForm.version) || 1,
    environment: configForm.environment,
    modality: configForm.modality,
    currency: configForm.currency.trim().toUpperCase(),
    priceIncludesTax: configForm.priceIncludesTax,
    defaultTaxRate: configForm.defaultTaxRate,
    roundingMode: configForm.roundingMode,
    sourceReference: configForm.sourceReference.trim(),
    validationStatus: configForm.validationStatus,
    active: configForm.active,
  };
  if (configForm.effectiveFrom) payload.effectiveFrom = new Date(configForm.effectiveFrom).toISOString();
  if (configForm.effectiveTo) payload.effectiveTo = new Date(configForm.effectiveTo).toISOString();
  if (configForm.verifiedBy.trim()) payload.verifiedBy = configForm.verifiedBy.trim();
  if (configForm.notes.trim()) payload.notes = configForm.notes.trim();

  configSaving.value = true;
  try {
    if (editingConfig.value) {
      await api.taxConfigurations.update(editingConfig.value.id, payload);
      notify('Configuración actualizada.', 'success');
    } else {
      const created = await api.taxConfigurations.create(payload);
      notify('Configuración creada.', 'success');
      selectedConfigId.value = created.id;
    }
    configModal.value = false;
    await reload();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    configSaving.value = false;
  }
}

async function openRules(configuration: TaxConfiguration): Promise<void> {
  selectedConfigId.value = configuration.id;
  ruleSource.value = configuration;
  ruleModal.value = true;
  try {
    rules.value = await api.taxConfigurations.rules(configuration.id);
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  }
}

function openRuleCreate(): void {
  editingRule.value = null;
  ruleForm.code = 'IVA';
  ruleForm.name = 'Impuesto al Valor Agregado (demo)';
  ruleForm.taxType = 'IVA';
  ruleForm.rate = '0.130000';
  ruleForm.sourceReference =
    'Valor de demostración. Verificar normativa vigente antes de usar.';
  ruleForm.validationStatus = 'PENDING_VERIFICATION';
}

function openRuleEdit(rule: TaxRule): void {
  editingRule.value = rule;
  ruleForm.code = rule.code;
  ruleForm.name = rule.name;
  ruleForm.taxType = rule.taxType;
  ruleForm.rate = rule.rate;
  ruleForm.sourceReference = rule.sourceReference;
  ruleForm.validationStatus = rule.validationStatus;
}

async function saveRule(): Promise<void> {
  if (!ruleSource.value) return;
  if (!ruleForm.code.trim() || !ruleForm.name.trim() || !ruleForm.sourceReference.trim()) {
    notify('Código, nombre y fuente de referencia son obligatorios.', 'warning');
    return;
  }
  const payload: Record<string, unknown> = {
    code: ruleForm.code.trim(),
    name: ruleForm.name.trim(),
    taxType: ruleForm.taxType.trim(),
    rate: ruleForm.rate,
    sourceReference: ruleForm.sourceReference.trim(),
    validationStatus: ruleForm.validationStatus,
  };
  ruleSaving.value = true;
  try {
    if (editingRule.value) {
      await api.taxConfigurations.updateRule(editingRule.value.id, payload);
      notify('Regla actualizada.', 'success');
    } else {
      await api.taxConfigurations.createRule(ruleSource.value.id, payload);
      notify('Regla creada.', 'success');
    }
    rules.value = await api.taxConfigurations.rules(ruleSource.value.id);
    editingRule.value = null;
    openRuleCreate();
    await reload();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    ruleSaving.value = false;
  }
}

/* ------------------------------ Carga ------------------------------------ */

async function reload(): Promise<void> {
  try {
    const [issuerList, configList] = await Promise.all([
      api.issuers.list(),
      api.taxConfigurations.list(),
    ]);
    issuers.value = issuerList;
    configurations.value = configList;

    if (!issuers.value.some((issuer) => issuer.id === selectedIssuerId.value)) {
      selectedIssuerId.value = issuers.value[0]?.id ?? '';
    }
    const currentBranches = selectedIssuer.value?.branches ?? [];
    if (!currentBranches.some((branch) => branch.id === selectedBranchId.value)) {
      selectedBranchId.value = currentBranches[0]?.id ?? '';
    }
    if (!configurations.value.some((configuration) => configuration.id === selectedConfigId.value)) {
      selectedConfigId.value = issuerConfigurations.value[0]?.id ?? '';
    }
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  }
}

function onIssuerChange(): void {
  selectedBranchId.value = branches.value[0]?.id ?? '';
}

watch(tab, (value) => {
  if (value === 'branches' || value === 'pos') {
    if (!selectedIssuerId.value && issuers.value.length) {
      selectedIssuerId.value = issuers.value[0].id;
    }
  }
});

onMounted(async () => {
  loading.value = true;
  await reload();
  loading.value = false;
});
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Configuración tributaria</h2>
        <p class="hint">Emisores, sucursales, puntos de venta, versiones y reglas configurables.</p>
      </div>
      <div class="spacer" />
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'issuers' }" type="button" @click="tab = 'issuers'">
          Emisores
        </button>
        <button class="tab" :class="{ active: tab === 'branches' }" type="button" @click="tab = 'branches'">
          Sucursales
        </button>
        <button class="tab" :class="{ active: tab === 'pos' }" type="button" @click="tab = 'pos'">
          Puntos de venta
        </button>
        <button class="tab" :class="{ active: tab === 'configs' }" type="button" @click="tab = 'configs'">
          Configuraciones
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="loading" class="card"><div class="loading-row"><span class="spinner large" /> Cargando configuración…</div></div>

    <template v-else>
      <div v-if="admin" class="alert alert-info">
        Su rol ADMIN permite crear y modificar la configuración. Los cambios quedan auditados.
      </div>

      <template v-if="tab === 'issuers'">
        <section class="card">
          <header class="card-header">
            <div class="card-title"><h2>Emisores</h2><p>{{ issuers.length }} emisor(es)</p></div>
            <div class="row">
              <button class="btn btn-ghost btn-sm" type="button" @click="reload">↻ Recargar</button>
              <button v-if="admin" class="btn btn-primary btn-sm" type="button" @click="openIssuerCreate">
                + Nuevo emisor
              </button>
            </div>
          </header>
          <div v-if="issuers.length === 0" class="empty">
            <strong>Sin emisores</strong>
            Registre un emisor para configurar la facturación.
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>NIT</th>
                  <th>Razón social</th>
                  <th>Dirección</th>
                  <th>Contacto</th>
                  <th>Sucursales</th>
                  <th>Configuraciones</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="issuer in issuers" :key="issuer.id">
                  <td class="mono">{{ issuer.nit }}</td>
                  <td>
                    <div>{{ issuer.legalName }}</div>
                    <div class="hint">{{ issuer.businessName || '—' }}</div>
                  </td>
                  <td class="hint">{{ issuer.address }}</td>
                  <td>
                    <div class="hint">{{ issuer.email || '—' }}</div>
                    <div class="hint">{{ issuer.phone || '—' }}</div>
                  </td>
                  <td>{{ issuer.branches?.length ?? 0 }}</td>
                  <td>{{ issuer.configurations?.length ?? 0 }}</td>
                  <td>
                    <StatusBadge
                      :status="issuer.active ? 'ACTIVO' : 'INACTIVO'"
                      :tone="issuer.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="actions-cell">
                    <button class="link-button" type="button" @click="selectedIssuerId = issuer.id; tab = 'branches'">
                      Sucursales
                    </button>
                    <button v-if="admin" class="link-button" type="button" @click="openIssuerEdit(issuer)">
                      Editar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="card">
          <div class="card-body">
            <div class="filter-bar">
              <div class="field grow">
                <label for="issuer-select">Emisor</label>
                <select id="issuer-select" v-model="selectedIssuerId" @change="onIssuerChange">
                  <option value="" disabled>Seleccione emisor</option>
                  <option v-for="issuer in issuers" :key="issuer.id" :value="issuer.id">
                    {{ issuer.legalName }} · NIT {{ issuer.nit }}
                  </option>
                </select>
              </div>
              <div v-if="tab === 'pos'" class="field grow">
                <label for="branch-select">Sucursal</label>
                <select id="branch-select" v-model="selectedBranchId">
                  <option value="" disabled>Seleccione sucursal</option>
                  <option v-for="branch in branches" :key="branch.id" :value="branch.id">
                    {{ branch.code }} · {{ branch.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-if="tab === 'branches'">
        <section class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Sucursales</h2>
              <p>{{ selectedIssuer?.legalName || 'Sin emisor' }} · {{ branches.length }}</p>
            </div>
            <button
              v-if="admin && selectedIssuerId"
              class="btn btn-primary btn-sm"
              type="button"
              @click="openBranchCreate"
            >
              + Nueva sucursal
            </button>
          </header>
          <div v-if="!selectedIssuerId" class="empty">Seleccione un emisor.</div>
          <div v-else-if="branches.length === 0" class="empty">
            <strong>Sin sucursales</strong>
            Agregue la primera sucursal del emisor.
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Municipio</th>
                  <th>Puntos de venta</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="branch in branches" :key="branch.id">
                  <td class="mono">{{ branch.code }}</td>
                  <td>{{ branch.name }}</td>
                  <td class="hint">{{ branch.address }}</td>
                  <td>{{ branch.municipality || '—' }}</td>
                  <td>{{ branch.pointsOfSale?.length ?? 0 }}</td>
                  <td>
                    <StatusBadge
                      :status="branch.active ? 'ACTIVO' : 'INACTIVO'"
                      :tone="branch.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="actions-cell">
                    <button class="link-button" type="button" @click="selectedBranchId = branch.id; tab = 'pos'">
                      Puntos de venta
                    </button>
                    <button v-if="admin" class="link-button" type="button" @click="openBranchEdit(branch)">
                      Editar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="tab === 'pos'">
        <section class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Puntos de venta</h2>
              <p>{{ selectedBranch ? `${selectedBranch.code} · ${selectedBranch.name}` : 'Seleccione sucursal' }}</p>
            </div>
            <button
              v-if="admin && selectedBranchId"
              class="btn btn-primary btn-sm"
              type="button"
              @click="openPosCreate"
            >
              + Nuevo punto de venta
            </button>
          </header>
          <div v-if="!selectedBranchId" class="empty">Seleccione una sucursal.</div>
          <div v-else-if="pointsOfSale.length === 0" class="empty">
            <strong>Sin puntos de venta</strong>
            Agregue una caja o terminal para emitir documentos.
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="pos in pointsOfSale" :key="pos.id">
                  <td class="mono">{{ pos.code }}</td>
                  <td>{{ pos.name }}</td>
                  <td>
                    <StatusBadge
                      :status="pos.active ? 'ACTIVO' : 'INACTIVO'"
                      :tone="pos.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="actions-cell">
                    <button v-if="admin" class="link-button" type="button" @click="openPosEdit(pos)">
                      Editar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="tab === 'configs'">
        <section class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Configuraciones tributarias</h2>
              <p>{{ issuerConfigurations.length }} versión(es) del emisor</p>
            </div>
            <div class="row">
              <button class="btn btn-ghost btn-sm" type="button" @click="reload">↻ Recargar</button>
              <button
                v-if="admin && selectedIssuerId"
                class="btn btn-primary btn-sm"
                type="button"
                @click="openConfigCreate"
              >
                + Nueva configuración
              </button>
            </div>
          </header>
          <div v-if="issuerConfigurations.length === 0" class="empty">
            <strong>Sin configuraciones para este emisor</strong>
            Cree una versión con tasa, moneda y referencia normativa.
          </div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Nombre</th>
                  <th>Ambiente</th>
                  <th>Modalidad</th>
                  <th>Moneda</th>
                  <th class="num">Tasa</th>
                  <th>Validación</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="configuration in issuerConfigurations" :key="configuration.id">
                  <td class="mono">v{{ configuration.version }}</td>
                  <td>{{ configuration.name }}</td>
                  <td>{{ environmentLabels[configuration.environment] || configuration.environment }}</td>
                  <td>{{ modalityLabels[configuration.modality] || configuration.modality }}</td>
                  <td>{{ configuration.currency }}</td>
                  <td class="num">{{ (Number(configuration.defaultTaxRate) * 100).toFixed(2) }} %</td>
                  <td>{{ validationLabels[configuration.validationStatus] || configuration.validationStatus }}</td>
                  <td>
                    <StatusBadge
                      :status="configuration.active ? 'ACTIVO' : 'INACTIVO'"
                      :tone="configuration.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="actions-cell">
                    <button class="link-button" type="button" @click="openRules(configuration)">Reglas</button>
                    <button v-if="admin" class="link-button" type="button" @click="openConfigEdit(configuration)">
                      Editar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="selectedConfiguration" class="card">
          <header class="card-header">
            <div class="card-title">
              <h2>Detalle de configuración v{{ selectedConfiguration.version }}</h2>
            </div>
          </header>
          <div class="card-body">
            <dl class="kv">
              <dt>Nombre</dt><dd>{{ selectedConfiguration.name }}</dd>
              <dt>Ambiente / modalidad</dt>
              <dd>
                {{ environmentLabels[selectedConfiguration.environment] }} ·
                {{ modalityLabels[selectedConfiguration.modality] }}
              </dd>
              <dt>Precio incluye impuesto</dt><dd>{{ selectedConfiguration.priceIncludesTax ? 'Sí' : 'No' }}</dd>
              <dt>Redondeo</dt><dd class="mono">{{ selectedConfiguration.roundingMode }}</dd>
              <dt>Fuente</dt><dd>{{ selectedConfiguration.sourceReference }}</dd>
              <dt>Notas</dt><dd>{{ selectedConfiguration.notes || '—' }}</dd>
            </dl>
            <div class="divider" />
            <JsonBlock :value="selectedConfiguration" title="Respuesta JSON" />
          </div>
        </section>
      </template>
    </template>

    <AppModal
      :open="issuerModal"
      :title="editingIssuer ? 'Editar emisor' : 'Nuevo emisor'"
      @close="issuerModal = false"
    >
      <div class="form-grid">
        <div class="field">
          <label for="i-nit">NIT</label>
          <input id="i-nit" v-model="issuerForm.nit" maxlength="20" placeholder="1234567890" />
        </div>
        <div class="field">
          <label for="i-activity">Actividad económica</label>
          <input id="i-activity" v-model="issuerForm.economicActivityCode" maxlength="20" />
        </div>
        <div class="field span-full">
          <label for="i-legal">Razón social</label>
          <input id="i-legal" v-model="issuerForm.legalName" maxlength="250" />
        </div>
        <div class="field span-full">
          <label for="i-business">Nombre comercial</label>
          <input id="i-business" v-model="issuerForm.businessName" maxlength="250" />
        </div>
        <div class="field span-full">
          <label for="i-address">Dirección</label>
          <input id="i-address" v-model="issuerForm.address" maxlength="500" />
        </div>
        <div class="field">
          <label for="i-phone">Teléfono</label>
          <input id="i-phone" v-model="issuerForm.phone" maxlength="40" />
        </div>
        <div class="field">
          <label for="i-email">Correo</label>
          <input id="i-email" v-model="issuerForm.email" type="email" maxlength="120" />
        </div>
        <div class="field span-full">
          <div class="checkbox-row">
            <input id="i-active" v-model="issuerForm.active" type="checkbox" />
            <label for="i-active">Emisor activo</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="issuerModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="issuerSaving" @click="saveIssuer">
          <span v-if="issuerSaving" class="spinner" />
          Guardar
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="branchModal"
      :title="editingBranch ? 'Editar sucursal' : 'Nueva sucursal'"
      @close="branchModal = false"
    >
      <div class="form-grid">
        <div class="field">
          <label for="b-code">Código</label>
          <input id="b-code" v-model="branchForm.code" maxlength="20" placeholder="SUC-01" />
        </div>
        <div class="field">
          <label for="b-name">Nombre</label>
          <input id="b-name" v-model="branchForm.name" maxlength="200" />
        </div>
        <div class="field span-full">
          <label for="b-address">Dirección</label>
          <input id="b-address" v-model="branchForm.address" maxlength="500" />
        </div>
        <div class="field">
          <label for="b-municipality">Municipio</label>
          <input id="b-municipality" v-model="branchForm.municipality" maxlength="120" />
        </div>
        <div class="field">
          <div class="checkbox-row" style="margin-top: 22px">
            <input id="b-active" v-model="branchForm.active" type="checkbox" />
            <label for="b-active">Sucursal activa</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="branchModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="branchSaving" @click="saveBranch">
          <span v-if="branchSaving" class="spinner" />
          Guardar
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="posModal"
      :title="editingPos ? 'Editar punto de venta' : 'Nuevo punto de venta'"
      @close="posModal = false"
    >
      <div class="form-grid">
        <div class="field">
          <label for="pos-code">Código</label>
          <input id="pos-code" v-model="posForm.code" maxlength="20" placeholder="PV-01" />
        </div>
        <div class="field">
          <label for="pos-name">Nombre</label>
          <input id="pos-name" v-model="posForm.name" maxlength="200" />
        </div>
        <div class="field span-full">
          <div class="checkbox-row">
            <input id="pos-active" v-model="posForm.active" type="checkbox" />
            <label for="pos-active">Punto de venta activo</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="posModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="posSaving" @click="savePos">
          <span v-if="posSaving" class="spinner" />
          Guardar
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="configModal"
      :title="editingConfig ? 'Editar configuración' : 'Nueva configuración'"
      wide
      @close="configModal = false"
    >
      <div class="form-grid cols-3">
        <div class="field span-2">
          <label for="cfg-name">Nombre</label>
          <input id="cfg-name" v-model="configForm.name" maxlength="150" />
        </div>
        <div class="field">
          <label for="cfg-version">Versión</label>
          <input id="cfg-version" v-model="configForm.version" type="number" min="1" />
        </div>
        <div class="field">
          <label for="cfg-environment">Ambiente</label>
          <select id="cfg-environment" v-model="configForm.environment">
            <option value="SIMULATED">Simulado</option>
            <option value="TEST">Pruebas</option>
            <option value="PRODUCTION">Producción</option>
          </select>
        </div>
        <div class="field">
          <label for="cfg-modality">Modalidad</label>
          <select id="cfg-modality" v-model="configForm.modality">
            <option value="ELECTRONICA_EN_LINEA">Electrónica en línea</option>
            <option value="COMPUTARIZADA_EN_LINEA">Computarizada en línea</option>
            <option value="PORTAL_WEB_EN_LINEA">Portal web en línea</option>
          </select>
        </div>
        <div class="field">
          <label for="cfg-currency">Moneda</label>
          <input id="cfg-currency" v-model="configForm.currency" maxlength="3" />
        </div>
        <div class="field">
          <label for="cfg-tax-rate">Tasa por defecto</label>
          <input id="cfg-tax-rate" v-model="configForm.defaultTaxRate" type="number" min="0" max="1" step="0.000001" />
        </div>
        <div class="field">
          <label for="cfg-rounding">Redondeo</label>
          <select id="cfg-rounding" v-model="configForm.roundingMode">
            <option value="ROUND_UP">ROUND_UP</option>
            <option value="ROUND_DOWN">ROUND_DOWN</option>
            <option value="ROUND_HALF_UP">ROUND_HALF_UP</option>
            <option value="ROUND_HALF_EVEN">ROUND_HALF_EVEN</option>
          </select>
        </div>
        <div class="field">
          <label for="cfg-validation">Validación</label>
          <select id="cfg-validation" v-model="configForm.validationStatus">
            <option value="PENDING_VERIFICATION">Pendiente</option>
            <option value="VERIFIED">Verificado</option>
            <option value="DEPRECATED">Obsoleto</option>
          </select>
        </div>
        <div class="field">
          <label for="cfg-from">Vigente desde</label>
          <input id="cfg-from" v-model="configForm.effectiveFrom" type="datetime-local" />
        </div>
        <div class="field">
          <label for="cfg-to">Vigente hasta</label>
          <input id="cfg-to" v-model="configForm.effectiveTo" type="datetime-local" />
        </div>
        <div class="field">
          <label for="cfg-verified-by">Verificado por</label>
          <input id="cfg-verified-by" v-model="configForm.verifiedBy" maxlength="150" />
        </div>
        <div class="field span-full">
          <label for="cfg-source">Fuente / referencia normativa</label>
          <textarea id="cfg-source" v-model="configForm.sourceReference" maxlength="2000" />
        </div>
        <div class="field span-full">
          <label for="cfg-notes">Notas</label>
          <textarea id="cfg-notes" v-model="configForm.notes" maxlength="2000" />
        </div>
        <div class="field">
          <div class="checkbox-row">
            <input id="cfg-price-tax" v-model="configForm.priceIncludesTax" type="checkbox" />
            <label for="cfg-price-tax">Precio incluye impuesto</label>
          </div>
        </div>
        <div class="field">
          <div class="checkbox-row">
            <input id="cfg-active" v-model="configForm.active" type="checkbox" />
            <label for="cfg-active">Configuración activa</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="configModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="configSaving" @click="saveConfig">
          <span v-if="configSaving" class="spinner" />
          Guardar
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="ruleModal"
      title="Reglas tributarias"
      :subtitle="ruleSource ? `${ruleSource.name} · v${ruleSource.version}` : ''"
      wide
      @close="ruleModal = false"
    >
      <div v-if="rules.length === 0" class="empty" style="padding: 18px">
        Esta configuración no tiene reglas propias; se aplica la tasa por defecto.
      </div>
      <div v-else class="table-wrap card" style="box-shadow: none">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th class="num">Tasa</th>
              <th>Validación</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in rules" :key="rule.id">
              <td class="mono">{{ rule.code }}</td>
              <td>{{ rule.name }}</td>
              <td>{{ rule.taxType }}</td>
              <td class="num">{{ (Number(rule.rate) * 100).toFixed(2) }} %</td>
              <td>{{ validationLabels[rule.validationStatus] || rule.validationStatus }}</td>
              <td class="actions-cell">
                <button v-if="admin" class="link-button" type="button" @click="openRuleEdit(rule)">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="admin" class="divider" />

      <div v-if="admin">
        <div class="row" style="justify-content: space-between">
          <strong>{{ editingRule ? `Editando regla ${editingRule.code}` : 'Nueva regla' }}</strong>
          <button v-if="editingRule" class="btn btn-ghost btn-sm" type="button" @click="openRuleCreate">
            Cancelar edición
          </button>
        </div>
        <div class="form-grid cols-3" style="margin-top: 12px">
          <div class="field">
            <label for="rule-code">Código</label>
            <input id="rule-code" v-model="ruleForm.code" maxlength="40" />
          </div>
          <div class="field span-2">
            <label for="rule-name">Nombre</label>
            <input id="rule-name" v-model="ruleForm.name" maxlength="150" />
          </div>
          <div class="field">
            <label for="rule-type">Tipo tributario</label>
            <input id="rule-type" v-model="ruleForm.taxType" maxlength="30" />
          </div>
          <div class="field">
            <label for="rule-rate">Tasa</label>
            <input id="rule-rate" v-model="ruleForm.rate" type="number" min="0" max="1" step="0.000001" />
          </div>
          <div class="field">
            <label for="rule-validation">Validación</label>
            <select id="rule-validation" v-model="ruleForm.validationStatus">
              <option value="PENDING_VERIFICATION">Pendiente</option>
              <option value="VERIFIED">Verificado</option>
              <option value="DEPRECATED">Obsoleto</option>
            </select>
          </div>
          <div class="field span-full">
            <label for="rule-source">Fuente / referencia</label>
            <textarea id="rule-source" v-model="ruleForm.sourceReference" maxlength="2000" />
          </div>
        </div>
        <div class="form-actions" style="margin-top: 12px">
          <button class="btn btn-primary" type="button" :disabled="ruleSaving" @click="saveRule">
            <span v-if="ruleSaving" class="spinner" />
            {{ editingRule ? 'Guardar regla' : 'Agregar regla' }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
