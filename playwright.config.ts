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
  // Retry twice on CI to absorb intermittent network/UI hiccups without
  // masking real regressions (a real bug still fails all 3 attempts).
  retries: process.env.CI ? 2 : 0,
  // Allow limited intra-shard parallelism on CI runners (2 vCPU); sharding
  // across jobs provides the primary speed-up.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['blob']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    // Keep trace + video for any failure (not only retries) so CI artifacts
    // always contain enough context to debug the failed run.
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
