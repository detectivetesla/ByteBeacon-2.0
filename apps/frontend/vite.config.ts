import { defineConfig } from 'vite';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const react = require('@vitejs/plugin-react');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bytebeacon/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'src/test-setup.ts')],
    include: ['apps/frontend/src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
});
