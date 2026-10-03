import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API runs on `wrangler dev`. If it isn't running, the app falls back to local-only mode.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
