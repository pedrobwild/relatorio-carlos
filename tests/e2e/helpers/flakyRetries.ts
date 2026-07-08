import { test } from '@playwright/test';

/**
 * Opt-in retry helper for tests known to be intermittent.
 *
 * Global `retries` is 0 (see playwright.config.ts) so real failures never get
 * masked. Call this at the top of a `describe` block — or from a single test
 * via `test.describe.configure` — only after you have investigated the flake
 * and documented the root cause in `reason`.
 *
 * Usage:
 *   test.describe('checkout webhook', () => {
 *     configureFlakyRetries({ reason: 'webhook delivery ~1% timeout' });
 *     test('processes payment', async ({ page }) => { ... });
 *   });
 *
 * The `reason` string is required and surfaces in test annotations, so a
 * reviewer can quickly see WHY a suite is allowed to retry. Retries default
 * to 2 on CI and 0 locally to keep the local signal deterministic.
 */
export function configureFlakyRetries(options: {
  reason: string;
  retries?: number;
}): void {
  const retries = options.retries ?? (process.env.CI ? 2 : 0);
  test.describe.configure({ retries });
  test.beforeEach((_, testInfo) => {
    testInfo.annotations.push({ type: 'flaky', description: options.reason });
  });
}
