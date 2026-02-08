import { test, expect } from './fixtures/auth';

test.describe('Documents', () => {
  test('should display document list', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}/documentos`);
    
    // Document page should load
    await expect(staffPage.locator('[data-testid="documents-page"]')).toBeVisible({ timeout: 10000 });
  });

  test('staff can see upload button', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}/documentos`);
    
    // Upload button should be visible for staff
    await expect(staffPage.locator('[data-testid="document-upload-button"]')).toBeVisible({ timeout: 10000 });
  });

  test('upload modal opens correctly', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}/documentos`);
    
    // Click upload button
    await staffPage.click('[data-testid="document-upload-button"]');
    
    // Modal should open
    await expect(staffPage.locator('[data-testid="document-upload-modal"]')).toBeVisible();
    
    // Form fields should be present
    await expect(staffPage.locator('[data-testid="document-category-select"]')).toBeVisible();
    await expect(staffPage.locator('[data-testid="document-name-input"]')).toBeVisible();
  });
});
