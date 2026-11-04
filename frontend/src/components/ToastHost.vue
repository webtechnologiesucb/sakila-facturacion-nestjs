<script setup lang="ts">
import { dismissToast, toasts } from '../lib/toast';
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.kind}`"
      role="status"
    >
      <p>{{ toast.message }}</p>
      <button type="button" aria-label="Cerrar" @click="dismissToast(toast.id)">×</button>
    </div>
  </div>
</template>
