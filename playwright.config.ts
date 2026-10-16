import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * End-to-end tests of the built package (dist/). Run `pnpm test`, which builds first.
 */
export default defineConfig({
  testDir: 'test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node test/server.mjs',
    url: `http://127.0.0.1:${PORT}/test/fixtures/viewers.html`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
