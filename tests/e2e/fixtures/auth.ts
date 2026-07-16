import { test as base, expect, Page } from '@playwright/test';

// Test user credentials from environment
const TEST_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer.test@bwild.com.br';
const TEST_CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'test123456';
const TEST_STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'staff.test@bwild.com.br';
const TEST_STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || 'test123456';
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || '';

export interface TestFixtures {
  customerPage: Page;
  staffPage: Page;
  testProjectId: string;
}

/**
 * Helper to login as a user
 */
async function loginAs(page: Page, email: string, password: string) {
  // Dispensa o banner LGPD antes de qualquer navegação para evitar que ele
  // sobreponha o botão "Entrar" em viewports mobile (390x844) e intercepte o
  // clique. O shape aqui precisa espelhar `ConsentState` em src/lib/consent.ts.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'bwild:consent',
        JSON.stringify({
          analytics: false,
          sessionReplay: false,
          decidedAt: new Date().toISOString(),
          version: 1,
        }),
      );
    } catch {
      // localStorage indisponível (modo privado) — segue sem consent pré-gravado.
    }
  });

  await page.goto('/auth');

  // Wait for the login form. If it never appears, surface the current URL and a
  // snippet of the page so CI failures are self-diagnosing — e.g. an app crash /
  // ErrorBoundary caused by missing VITE_SUPABASE_* config renders no form at all.
  try {
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
  } catch (e) {
    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => '<unavailable>');
    const original = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Login form not found at /auth.\n` +
        `Current URL: ${page.url()}\n` +
        `Email used: ${email}\n` +
        `Page text (first 300 chars): ${bodyText.slice(0, 300)}\n` +
        `Original error: ${original}`,
    );
  }

  // Fill credentials
  await page.fill('[data-testid="login-identifier"]', email);
  await page.fill('[data-testid="login-password"]', password);
  
  // Submit
  await page.click('[data-testid="login-submit"]');
  
  // Wait for redirect (should leave /auth)
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15000 });
}

/**
 * Extended test fixture with authenticated pages
 */
/* eslint-disable react-hooks/rules-of-hooks, no-empty-pattern */
export const test = base.extend<TestFixtures>({
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);
    await use(page);
    await context.close();
  },

  staffPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
    await use(page);
    await context.close();
  },

  // Playwright requires the first fixture arg to be an object destructuring
  // pattern; this fixture has no dependencies, so it's an empty pattern.
  testProjectId: async ({}, use) => {
    await use(TEST_PROJECT_ID);
  },
});
/* eslint-enable react-hooks/rules-of-hooks, no-empty-pattern */

export { expect };
export { loginAs };
