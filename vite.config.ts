import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  test: {
    // Scan all of src/, not just the vite root, so main-process logic is tested too.
    // Main-process test files opt into Node with a `@vitest-environment node` docblock.
    dir: path.resolve(__dirname, 'src'),
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, 'src/renderer/setupTests.ts'),
  }
});
