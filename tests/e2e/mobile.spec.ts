import { test, expect } from './fixtures/auth';

/**
 * Mobile-specific E2E tests.
 * All tests use a 375x812 viewport (iPhone X dimensions).
 */
test.describe('Mobile UX', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.describe('Gestão / Obras', () => {
    test('should render mobile bottom nav', async ({ staffPage }) => {
      await staffPage.goto('/gestao');
      // Bottom nav should be visible
      const bottomNav = staffPage.locator('[data-testid="gestao-bottom-nav"], nav[aria-label]').last();
      await expect(bottomNav).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to nova obra via mobile', async ({ staffPage }) => {
      await staffPage.goto('/gestao');
      // FAB or "Nova Obra" button should be accessible
      const createBtn = staffPage.locator('a[href*="nova-obra"], button:has-text("Nova")').first();
      await expect(createBtn).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Atividades', () => {
    test('should show mobile list view', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/atividades`);
      // Should show the activities heading
      await expect(staffPage.locator('h1:has-text("Atividades")')).toBeVisible({ timeout: 10000 });
      // "Nova" button should be visible
      await expect(staffPage.locator('button:has-text("Nova")')).toBeVisible();
    });

    test('should show filter chips', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/atividades`);
      // Filter chips should be scrollable
      await expect(staffPage.locator('button:has-text("Todos")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Cronograma', () => {
    test('should show mobile monitoring view', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/cronograma`);
      // Should show progress percentage or empty state
      const content = staffPage.locator('text=/\\d+%|Cronograma não cadastrado/');
      await expect(content).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Documentos', () => {
    test('should load documents page on mobile', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/documentos`);
      await expect(staffPage.locator('[data-testid="documents-page"]')).toBeVisible({ timeout: 10000 });
    });

    test('document card should show download and share buttons', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/documentos`);
      // If there are documents, download buttons should be visible on mobile
      const downloadBtn = staffPage.locator('button[aria-label="Baixar"]').first();
      const hasDocuments = await downloadBtn.isVisible().catch(() => false);
      if (hasDocuments) {
        await expect(downloadBtn).toBeVisible();
        // Share button should also be visible on mobile
        const shareBtn = staffPage.locator('button[aria-label="Compartilhar"]').first();
        await expect(shareBtn).toBeVisible();
      }
    });
  });

  test.describe('Vistorias', () => {
    test('should load vistorias page on mobile', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/vistorias`);
      // Should show "Vistorias & NC" or the tabs
      await expect(staffPage.locator('text=/Vistorias|Nova Vistoria/')).toBeVisible({ timeout: 10000 });
    });

    test('NC tab should show management panel', async ({ staffPage, testProjectId }) => {
      if (!testProjectId) { test.skip(); return; }
      await staffPage.goto(`/obra/${testProjectId}/vistorias`);
      // Switch to NCs tab
      const ncTab = staffPage.locator('button:has-text("NCs")');
      await expect(ncTab).toBeVisible({ timeout: 10000 });
      await ncTab.click();
      // Should show either empty state or NC list
      await expect(staffPage.locator('text=/Nenhuma não conformidade|Pendentes|Abertas/')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Network banner', () => {
    test('should show offline banner when disconnected', async ({ staffPage }) => {
      await staffPage.goto('/gestao');
      await staffPage.waitForTimeout(1000);
      
      // Simulate offline
      await staffPage.evaluate(() => {
        window.dispatchEvent(new Event('offline'));
      });
      
      // Banner should appear
      await expect(staffPage.locator('text=Sem conexão')).toBeVisible({ timeout: 3000 });
      
      // Simulate back online
      await staffPage.evaluate(() => {
        window.dispatchEvent(new Event('online'));
      });
      
      // Should show reconnected message
      await expect(staffPage.locator('text=Conexão restabelecida')).toBeVisible({ timeout: 3000 });
    });
  });
});
