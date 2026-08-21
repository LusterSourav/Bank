import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['contracts/**', 'frontend/**', 'node_modules/**'],
    setupFiles: ['./test/setup.js'],
  },
})
