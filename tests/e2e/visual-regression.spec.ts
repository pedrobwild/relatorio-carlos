import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for key mobile views.
 * Takes screenshots and compares against baselines.
 * 
 * Run: npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
 * to generate initial baselines.
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

test.describe('Visual Regression - Mobile', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('auth page renders consistently', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('auth-mobile.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });

  test('gestão page layout', async ({ page }) => {
    await page.goto('/gestao');
    await page.waitForLoadState('networkidle');
    // Wait for skeleton or content
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('gestao-mobile.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });

  test('bottom nav visibility on mobile', async ({ page }) => {
    await page.goto('/gestao');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Capture just the bottom area for nav regression
    const bottomNav = page.locator('nav').last();
    if (await bottomNav.isVisible()) {
      await expect(bottomNav).toHaveScreenshot('bottom-nav-mobile.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });
});

test.describe('Visual Regression - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('auth page renders consistently', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('auth-desktop.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });

  test('gestão page layout', async ({ page }) => {
    await page.goto('/gestao');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('gestao-desktop.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });
});
