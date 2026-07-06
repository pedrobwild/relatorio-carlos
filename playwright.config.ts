import { defineConfig, devices } from '@playwright/test';

/**
 * Portal BWild - Playwright E2E Configuration
 * 
 * Run: npx playwright test
 * UI Mode: npx playwright test --ui
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries are opt-in per suite via `configureFlakyRetries()` (see
  // tests/e2e/helpers/flakyRetries.ts). Global default is 0 on CI so real
  // failures are never masked; only tests explicitly tagged as flaky retry.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ['github'],
        ['list'],
        ['html', { open: 'never' }],
        ['blob'],
        ['junit', { outputFile: 'playwright-report/junit.xml' }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox optional for extended testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],
  // When no external PLAYWRIGHT_BASE_URL is provided (e.g. the a11y job on
  // PRs, which has no secrets), Playwright starts the app itself so the
  // suite is self-contained. When a deployed URL is provided, tests run
  // against it and no local server is started.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --host 0.0.0.0',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
