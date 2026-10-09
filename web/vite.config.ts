import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Builds into ../public so `npm start` serves the UI with no build step at runtime.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  publicDir: 'public_static',
  // No source maps in the build: the served app should not ship its source.
  build: { outDir: '../public', emptyOutDir: true, chunkSizeWarningLimit: 900, sourcemap: false },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4173', '/openapi.yaml': 'http://localhost:4173' } },
});
