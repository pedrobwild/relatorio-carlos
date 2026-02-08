import { test, expect } from './fixtures/auth';

test.describe('Cronograma / Schedule', () => {
  test('should display schedule tab content', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}`);
    
    // Wait for tabs to load
    await expect(staffPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
    
    // Click on cronograma tab
    const cronogramaTab = staffPage.locator('[data-testid="tab-cronograma"]');
    if (await cronogramaTab.isVisible()) {
      await cronogramaTab.click();
    }
    
    // Schedule content should load (table or gantt)
    await expect(
      staffPage.locator('[data-testid="schedule-table"], [data-testid="gantt-chart"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('activities table should display data', async ({ staffPage, testProjectId }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}`);
    
    // Navigate to cronograma
    await expect(staffPage.locator('[data-testid="project-tabs"]')).toBeVisible({ timeout: 10000 });
    
    const cronogramaTab = staffPage.locator('[data-testid="tab-cronograma"]');
    if (await cronogramaTab.isVisible()) {
      await cronogramaTab.click();
    }
    
    // Wait for table
    const table = staffPage.locator('[data-testid="schedule-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });
    
    // Should have at least header row
    await expect(table.locator('thead')).toBeVisible();
  });
});
