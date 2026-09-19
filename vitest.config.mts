import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@shared': path.resolve(import.meta.dirname, 'src/shared') }
  },
  test: {
    include: ['src/**/*.test.ts']
  }
})
