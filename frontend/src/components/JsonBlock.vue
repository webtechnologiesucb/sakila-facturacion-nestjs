<script setup lang="ts">
import { computed, ref } from 'vue';
import { prettyJson } from '../lib/format';

const props = withDefaults(
  defineProps<{
    value: unknown;
    title?: string;
    open?: boolean;
    maxHeight?: string;
  }>(),
  { title: 'Respuesta JSON', open: false, maxHeight: '420px' },
);

const visible = ref(props.open);
const content = computed(() => prettyJson(props.value));
</script>

<template>
  <div class="json-block">
    <div class="json-header">
      <button class="btn btn-ghost btn-sm" type="button" @click="visible = !visible">
        {{ visible ? '▾' : '▸' }} {{ title }}
      </button>
      <span class="hint">{{ content.length }} caracteres</span>
    </div>
    <pre v-if="visible" class="code-block" :style="{ maxHeight }">{{ content }}</pre>
  </div>
</template>
