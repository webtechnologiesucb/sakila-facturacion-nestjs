<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ToastHost from './components/ToastHost.vue';
import { roleLabels } from './lib/format';
import { clearSession, isAdmin, loadSession, session } from './lib/session';

const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);

const isPublic = computed(() => Boolean(route.meta.public));
const pageTitle = computed(() => String(route.meta.title ?? 'Sakila Facturación'));
const admin = computed(() => isAdmin());
const userInitials = computed(() => {
  const source = session.user?.name || session.user?.email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
});

const navigation = computed(() => [
  {
    label: 'Operación',
    items: [
      { to: '/', label: 'Panel general', icon: '◉' },
      { to: '/invoices', label: 'Facturas', icon: '▤' },
      { to: '/customers', label: 'Clientes', icon: '☺' },
      { to: '/products', label: 'Productos', icon: '▦' },
    ],
  },
  {
    label: 'Procesos',
    items: [
      { to: '/configuration', label: 'Configuración', icon: '⚙' },
      { to: '/contingencies', label: 'Contingencias', icon: '⚠' },
      { to: '/cancellations', label: 'Anulaciones', icon: '↺' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { to: '/reports', label: 'Reportes', icon: '◫' },
      ...(admin.value ? [{ to: '/audit', label: 'Auditoría', icon: '☰' }] : []),
      ...(admin.value ? [{ to: '/users', label: 'Usuarios', icon: '♟' }] : []),
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/system', label: 'Estado de la API', icon: '♥' },
      { to: '/sakila', label: 'Referencia Sakila', icon: '◎' },
    ],
  },
]);

function logout(): void {
  clearSession();
  router.replace({ name: 'login' });
}

function handleForcedLogout(): void {
  router.replace({ name: 'login', query: { redirect: route.fullPath } });
}

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false;
  },
);

onMounted(() => {
  loadSession();
  window.addEventListener('sakila:logout', handleForcedLogout);
});

onBeforeUnmount(() => {
  window.removeEventListener('sakila:logout', handleForcedLogout);
});
</script>

<template>
  <div v-if="isPublic" class="public-shell">
    <RouterView />
    <ToastHost />
  </div>

  <div v-else class="app-shell" :class="{ 'sidebar-open': sidebarOpen }">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">SF</div>
        <div>
          <strong>Sakila Facturación</strong>
          <span>Consola de pruebas</span>
        </div>
      </div>

      <nav class="side-nav">
        <div v-for="group in navigation" :key="group.label" class="nav-group">
          <p class="nav-label">{{ group.label }}</p>
          <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" class="nav-link">
            <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-footer">
        <p>Prototipo académico</p>
        <span>No certificado por el SIN · XML simulado</span>
      </div>
    </aside>

    <div class="sidebar-backdrop" @click="sidebarOpen = false" />

    <div class="main-column">
      <header class="topbar">
        <button class="mobile-toggle" type="button" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>
        <div>
          <h1>{{ pageTitle }}</h1>
          <p class="topbar-subtitle">API REST · Facturación electrónica simulada</p>
        </div>
        <div class="topbar-user">
          <div class="avatar">{{ userInitials }}</div>
          <div class="user-meta">
            <strong>{{ session.user?.name || 'Usuario' }}</strong>
            <span>{{ session.user ? roleLabels[session.user.role] : 'Sin sesión' }}</span>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" @click="logout">Salir</button>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>

      <footer class="app-footer">
        <span>Sakila Facturación · entorno de demostración</span>
        <span>Los comprobantes y firmas generados no son documentos fiscales oficiales.</span>
      </footer>
    </div>

    <ToastHost />
  </div>
</template>
