import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:8731' } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.{js,jsx}'],
    setupFiles: ['tests/frontend/setup.js'],
  },
});
