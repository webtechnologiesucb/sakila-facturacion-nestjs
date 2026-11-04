import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated, loadSession } from '../lib/session';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: 'Iniciar sesión', public: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: 'Panel general' },
    },
    {
      path: '/invoices',
      name: 'invoices',
      component: () => import('../views/InvoicesView.vue'),
      meta: { title: 'Facturas' },
    },
    {
      path: '/invoices/new',
      name: 'invoice-new',
      component: () => import('../views/InvoiceCreateView.vue'),
      meta: { title: 'Nueva factura' },
    },
    {
      path: '/invoices/:id',
      name: 'invoice-detail',
      component: () => import('../views/InvoiceDetailView.vue'),
      meta: { title: 'Detalle de factura' },
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('../views/CustomersView.vue'),
      meta: { title: 'Clientes fiscales' },
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('../views/ProductsView.vue'),
      meta: { title: 'Productos y categorías' },
    },
    {
      path: '/configuration',
      name: 'configuration',
      component: () => import('../views/ConfigurationView.vue'),
      meta: { title: 'Configuración tributaria' },
    },
    {
      path: '/contingencies',
      name: 'contingencies',
      component: () => import('../views/ContingenciesView.vue'),
      meta: { title: 'Contingencias' },
    },
    {
      path: '/cancellations',
      name: 'cancellations',
      component: () => import('../views/CancellationsView.vue'),
      meta: { title: 'Solicitudes de anulación' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: () => import('../views/ReportsView.vue'),
      meta: { title: 'Reportes' },
    },
    {
      path: '/audit',
      name: 'audit',
      component: () => import('../views/AuditView.vue'),
      meta: { title: 'Auditoría', admin: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UsersView.vue'),
      meta: { title: 'Usuarios', admin: true },
    },
    {
      path: '/sakila',
      name: 'sakila',
      component: () => import('../views/SakilaView.vue'),
      meta: { title: 'Referencia Sakila' },
    },
    {
      path: '/system',
      name: 'system',
      component: () => import('../views/SystemView.vue'),
      meta: { title: 'Estado del sistema' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach((to) => {
  loadSession();
  if (to.meta.public) {
    if (to.name === 'login' && isAuthenticated()) return { name: 'dashboard' };
    return true;
  }
  if (!isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
