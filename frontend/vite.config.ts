import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// El frontend usa /api como ruta relativa. En desarrollo Vite la redirige a
// la API local; en producción nginx (frontend/nginx.conf) hace el proxy.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
