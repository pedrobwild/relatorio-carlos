import { test, expect } from './fixtures/auth';

test.describe('Obras - Customer Flow', () => {
  test('customer can see "Minhas Obras" list', async ({ customerPage }) => {
    await customerPage.goto('/minhas-obras');
    
    // Page should load
    await expect(customerPage.locator('[data-testid="obras-list"]')).toBeVisible({ timeout: 10000 });
    
    // Header should be visible
    await expect(customerPage.locator('h2:has-text("Minhas Obras")')).toBeVisible();
  });

  test('customer can access project dashboard', async ({ customerPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }
    
    await customerPage.goto(`/obra/${testProjectId}`);
    
    // Main content should load
    await expect(customerPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
  });

  test('customer cannot access staff routes', async ({ customerPage }) => {
    await customerPage.goto('/gestao');
    
    // Should be redirected away or see access denied
    await expect(customerPage).not.toHaveURL('/gestao');
  });
});

test.describe('Obras - Staff Flow', () => {
  test('staff can see "Gestão de Obras" list', async ({ staffPage }) => {
    await staffPage.goto('/gestao');
    
    // Page should load
    await expect(staffPage.locator('[data-testid="gestao-obras-list"]')).toBeVisible({ timeout: 10000 });
    
    // Header should be visible
    await expect(staffPage.locator('h1:has-text("Gestão de Obras")')).toBeVisible();
  });

  test('staff can access project dashboard', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }
    
    await staffPage.goto(`/obra/${testProjectId}`);
    
    // Main content should load
    await expect(staffPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
  });
});
