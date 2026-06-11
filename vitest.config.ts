import { defineConfig } from 'vitest/config'

// Document-core unit tests run in Node against @cantoo/pdf-lib operating on
// fixture PDF bytes. No DOM/jsdom needed for the core.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text', 'lcov'],
    },
  },
})
