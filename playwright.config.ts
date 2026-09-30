import { defineConfig } from '@playwright/test'

const ci = process.env.CI !== undefined

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'out/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: ci,
  workers: ci ? 1 : undefined,
  reporter: ci ? 'github' : 'list'
})
