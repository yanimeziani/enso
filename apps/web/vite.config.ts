import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolveFromRoot = (...segments: string[]) => path.resolve(__dirname, '..', '..', ...segments);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@enso/core': resolveFromRoot('packages', 'core', 'src'),
      '@enso/ui': resolveFromRoot('packages', 'ui', 'src'),
      '@enso/lynx': resolveFromRoot('packages', 'lynx', 'src')
    }
  },
  server: {
    port: 5173
  }
});
