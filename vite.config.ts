import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH sets the sub-path on GitHub Pages (the workflow uses "/<repository>/").
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 4000 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
