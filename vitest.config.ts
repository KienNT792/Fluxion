import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
