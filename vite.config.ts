import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      // The ONNX runtime transformers.js loads at run time. Its package exports
      // hide dist/, so reach it by path and bundle it, rather than letting it
      // load from a CDN (which the CSP blocks anyway).
      'ort-runtime': path.resolve(__dirname, 'node_modules/@huggingface/transformers/dist'),
    },
  },
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
