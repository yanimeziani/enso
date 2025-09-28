import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage',
      exclude: ['**/index.ts']
    }
  }
});
