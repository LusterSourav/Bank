import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: { external: ['@noir-lang/noir_js', '@noir-lang/backend_barretenberg'] },
  },
});
