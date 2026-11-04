<script setup lang="ts">
import { computed } from 'vue';
import {
  cancellationStatusLabels,
  contingencyStatusLabels,
  invoiceStatusLabels,
  invoiceStatusTone,
} from '../lib/format';

const props = withDefaults(
  defineProps<{
    status: string;
    label?: string;
    tone?: string;
  }>(),
  { label: '', tone: '' },
);

const allLabels: Record<string, string> = {
  ...invoiceStatusLabels,
  ...cancellationStatusLabels,
  ...contingencyStatusLabels,
  ABIERTA: 'Abierta',
  CERRADA: 'Cerrada',
  REGULARIZADA: 'Regularizada',
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  VERIFIED: 'Verificado',
  PENDING_VERIFICATION: 'Pendiente de verificación',
  DEPRECATED: 'Obsoleto',
};

const allTones: Record<string, string> = {
  ...invoiceStatusTone,
  ABIERTA: 'warning',
  CERRADA: 'neutral',
  REGULARIZADA: 'success',
  APROBADA: 'success',
  RECHAZADA: 'danger',
  REVERTIDA: 'warning',
  PENDIENTE: 'warning',
  ACTIVO: 'success',
  INACTIVO: 'neutral',
  VERIFIED: 'success',
  PENDING_VERIFICATION: 'warning',
  DEPRECATED: 'neutral',
};

const text = computed(() => props.label || allLabels[props.status] || props.status);
const toneClass = computed(() => props.tone || allTones[props.status] || 'neutral');
</script>

<template>
  <span class="badge" :class="`badge-${toneClass}`">{{ text }}</span>
</template>
