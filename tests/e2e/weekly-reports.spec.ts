import { test, expect } from './fixtures/auth';

test.describe('Weekly Reports', () => {
  test('should display weekly report tab content', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}`);
    
    // Wait for tabs to load
    await expect(staffPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
    
    // Click on reports tab (if not default)
    const reportsTab = staffPage.locator('[data-testid="tab-relatorio"]');
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }
    
    // Report content should load
    await expect(staffPage.locator('[data-testid="weekly-report-content"]')).toBeVisible({ timeout: 10000 });
  });

  test('should be able to create or edit weekly report', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}`);
    
    // Wait for tabs
    await expect(staffPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
    
    // Navigate to reports
    const reportsTab = staffPage.locator('[data-testid="tab-relatorio"]');
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }
    
    // Look for create or edit button
    const createBtn = staffPage.locator('[data-testid="create-report-button"]');
    const editBtn = staffPage.locator('[data-testid="edit-report-button"]');
    
    // At least one should be visible for staff
    const hasCreate = await createBtn.isVisible().catch(() => false);
    const hasEdit = await editBtn.isVisible().catch(() => false);
    
    expect(hasCreate || hasEdit).toBe(true);
  });
});
