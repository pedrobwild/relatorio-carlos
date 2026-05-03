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
  await page.goto('/auth');
  
  // Wait for login form
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
  
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
/* eslint-disable react-hooks/rules-of-hooks */
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

  testProjectId: async (_params, use) => {
    await use(TEST_PROJECT_ID);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

export { expect };
export { loginAs };
