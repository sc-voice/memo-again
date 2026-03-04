import { defineConfig } from '@sc-voice/vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.mjs'],
    exclude: [],
    setupFiles: [],
  },
});
