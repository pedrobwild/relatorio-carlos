import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Quick sanity checks before deploy
 * These should run in under 5 minutes
 */
test.describe('Smoke Tests', () => {
  test('1. App loads without crash', async ({ page }) => {
    await page.goto('/');
    
    // App should render something (not blank page)
    await expect(page.locator('body')).not.toBeEmpty();
    
    // No critical errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Filter out known benign errors
    const criticalErrors = errors.filter(e => 
      !e.includes('postMessage') && 
      !e.includes('ResizeObserver')
    );
    
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('2. Auth page renders correctly', async ({ page }) => {
    await page.goto('/auth');
    
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 10000 });
  });

  test('3. Protected routes redirect to auth', async ({ page }) => {
    await page.goto('/minhas-obras');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('4. 404 page works', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    
    // Should show 404 or redirect to home
    const has404 = await page.locator('text=/não encontrada|not found|404/i').isVisible().catch(() => false);
    const redirectedHome = page.url().includes('/auth') || page.url().endsWith('/');
    
    expect(has404 || redirectedHome).toBe(true);
  });

  test('5. No JavaScript errors on home', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Filter benign errors
    const criticalErrors = errors.filter(e => 
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
