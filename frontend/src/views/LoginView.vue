<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessage } from '../lib/api';
import { loadSession, persistSession } from '../lib/session';
import { notify } from '../lib/toast';

const router = useRouter();
const route = useRoute();

const email = ref('admin@sakila.demo');
const password = ref('Admin123!Demo');
const loading = ref(false);
const error = ref('');
const apiStatus = ref<'checking' | 'ok' | 'error'>('checking');

async function submit(): Promise<void> {
  error.value = '';
  loading.value = true;
  try {
    const login = await api.auth.login(email.value.trim(), password.value);
    persistSession(login);
    loadSession();
    notify(`Bienvenido, ${login.user.name}`, 'success');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (caught) {
    error.value = errorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function useDemo(): void {
  email.value = 'admin@sakila.demo';
  password.value = 'Admin123!Demo';
}

onMounted(async () => {
  try {
    const health = await api.system.health();
    apiStatus.value = health.status === 'ok' ? 'ok' : 'error';
  } catch {
    apiStatus.value = 'error';
  }
});
</script>

<template>
  <div class="login-page">
    <section class="login-card">
      <div class="login-hero">
        <div class="brand">
          <div class="brand-mark">SF</div>
          <div>
            <strong>Sakila Facturación</strong>
            <span>Consola de pruebas de la API</span>
          </div>
        </div>

        <div>
          <h2>Pruebe el ciclo completo de facturación electrónica.</h2>
          <p>
            Genere borradores, emita comprobantes simulados, envíe al proveedor tributario,
            consulte XML, gestione contingencias y anulaciones, y revise reportes y auditoría.
          </p>
          <div class="login-points">
            <span>Autenticación JWT con renovación automática</span>
            <span>Datos de demostración Sakila y PostgreSQL</span>
            <span>Documentos y firmas simuladas, sin validez fiscal</span>
          </div>
        </div>

        <footer>
          Prototipo académico · No certificado por el SIN · No use datos reales
        </footer>
      </div>

      <div class="login-form">
        <h1>Iniciar sesión</h1>
        <p>Acceda con un usuario de la API para probar los endpoints.</p>

        <div v-if="error" class="alert alert-error" style="margin-bottom: 16px">
          {{ error }}
        </div>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="email">Correo electrónico</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="usuario@sakila.demo"
              required
            />
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••••"
              required
            />
          </div>

          <div class="form-actions">
            <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
              <span v-if="loading" class="spinner" />
              {{ loading ? 'Ingresando…' : 'Ingresar' }}
            </button>
          </div>
        </form>

        <div class="demo-box">
          <strong>Credenciales demo</strong>
          admin@sakila.demo · Admin123!Demo
          <button class="link-button" type="button" style="margin-left: 6px" @click="useDemo">
            Usar
          </button>
        </div>

        <div class="row" style="margin-top: 18px; font-size: 11.5px; color: var(--muted)">
          <span class="status-dot" :class="apiStatus === 'ok' ? 'ok' : apiStatus === 'error' ? 'fail' : ''" />
          <span v-if="apiStatus === 'ok'">API disponible</span>
          <span v-else-if="apiStatus === 'error'">No se pudo contactar la API</span>
          <span v-else>Verificando API…</span>
        </div>
      </div>
    </section>
  </div>
</template>
