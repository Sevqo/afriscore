import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const apiPort = process.env.DEV_API_PORT || '4005';
const publicHost = process.env.APP_PUBLIC_URL ? new URL(process.env.APP_PUBLIC_URL).hostname : undefined;
const certificate = process.env.DEV_TLS_CERT;
const privateKey = process.env.DEV_TLS_KEY;
if (!!certificate !== !!privateKey) throw new Error('Set both DEV_TLS_CERT and DEV_TLS_KEY.');

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-dom/client'],
        },
      },
    },
  },
  server: {
    host: process.env.DEV_HOST || '0.0.0.0',
    port: Number(process.env.DEV_PORT || 5175),
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../dashboard/shared', import.meta.url))] },
    allowedHosts: publicHost ? [publicHost] : [],
    https: certificate && privateKey ? {cert: fs.readFileSync(certificate), key: fs.readFileSync(privateKey)} : undefined,
    proxy: { '/api': `http://127.0.0.1:${apiPort}`, '/v1': `http://127.0.0.1:${apiPort}` },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});
