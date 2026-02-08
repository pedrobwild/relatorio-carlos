import { test, expect } from '@playwright/test';

test.describe('Authentication & Guards', () => {
  test('should display login form', async ({ page }) => {
    await page.goto('/auth');
    
    // Login form should be visible
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-identifier"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/auth');
    
    // Try to submit empty form
    await page.click('[data-testid="login-submit"]');
    
    // Should show validation error toast or inline error
    // (The form has browser validation, so it won't submit)
    const emailInput = page.locator('[data-testid="login-identifier"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should redirect unauthenticated users to /auth', async ({ page }) => {
    // Try to access protected route
    await page.goto('/minhas-obras');
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should redirect unauthenticated users from staff route to /auth', async ({ page }) => {
    await page.goto('/gestao');
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('should show signup tab', async ({ page }) => {
    await page.goto('/auth');
    
    // Click on signup tab
    await page.click('button:has-text("Criar conta")');
    
    // Signup form should be visible
    await expect(page.locator('[data-testid="signup-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-submit"]')).toBeVisible();
  });
});
