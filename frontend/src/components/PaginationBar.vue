<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}>();

const emit = defineEmits<{ 'update:page': [page: number] }>();

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.limit + 1));
const to = computed(() => Math.min(props.page * props.limit, props.total));

function go(page: number): void {
  if (page < 1 || page > props.totalPages || page === props.page) return;
  emit('update:page', page);
}
</script>

<template>
  <div class="pagination">
    <span class="hint">{{ from }}–{{ to }} de {{ total }}</span>
    <div class="pagination-actions">
      <button class="btn btn-secondary btn-sm" type="button" :disabled="page <= 1" @click="go(page - 1)">
        ← Anterior
      </button>
      <span class="page-indicator">Página {{ page }} / {{ Math.max(totalPages, 1) }}</span>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        Siguiente →
      </button>
    </div>
  </div>
</template>
