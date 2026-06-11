import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// E2E runs against the BUILT single file (dist/pedift.html), served over HTTP.
// We serve dist/ rather than using file:// because Playwright's download capture
// needs an HTTP Content-Disposition response to fire reliably.
// Run: npm run build && npm run test:e2e
const dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(dirname, 'dist')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    // `serve` rewrites /pedift.html -> /pedift (404); use http-server which
    // serves files at their exact paths without clean-URL mangling.
    command: `npx http-server -p 4173 --cors -c-1 "${DIST_DIR}"`,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
