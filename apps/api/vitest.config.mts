import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [nxViteTsPaths()],
  test: {
    environment: 'node',
    include: ['src/test/**/*.spec.ts'],
    passWithNoTests: false,
  },
});
