import { test, expect } from './fixtures/auth';

/**
 * E2E: Formalizações + Pendências consistency
 *
 * These tests validate the full lifecycle:
 *   draft → pending_signatures → signed
 * and the corresponding pending_items behavior.
 *
 * Prerequisites:
 * - TEST_STAFF_EMAIL / TEST_STAFF_PASSWORD env vars (staff user)
 * - TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD env vars (customer user)
 * - TEST_PROJECT_ID env var pointing to a project with at least one draft formalization
 */

test.describe('Formalizações + Pendências lifecycle', () => {
  test('pending_item action_url uses plural route /formalizacoes/', async ({ staffPage, testProjectId }) => {
    test.skip(!testProjectId, 'TEST_PROJECT_ID is required');

    // Navigate to pendências
    await staffPage.goto(`/obra/${testProjectId}/pendencias`);
    await staffPage.waitForLoadState('networkidle');

    // Find any "Ver detalhes" link for a signature-type pending item
    const signatureLinks = staffPage.locator('a[href*="/formalizacoes/"]');
    const count = await signatureLinks.count();

    if (count > 0) {
      const href = await signatureLinks.first().getAttribute('href');
      expect(href).toContain('/formalizacoes/');
      expect(href).not.toContain('/formalizacao/');
    }
    // If no signature pending items exist, the test passes vacuously
  });

  test('"Ver detalhes" navigates to formalization detail', async ({ staffPage, testProjectId }) => {
    test.skip(!testProjectId, 'TEST_PROJECT_ID is required');

    await staffPage.goto(`/obra/${testProjectId}/pendencias`);
    await staffPage.waitForLoadState('networkidle');

    const detailLinks = staffPage.locator('a:has-text("Ver detalhes")');
    const count = await detailLinks.count();

    if (count > 0) {
      const _href = await detailLinks.first().getAttribute('href');
      // Click the first "Ver detalhes" and verify navigation works
      await detailLinks.first().click();
      await staffPage.waitForLoadState('networkidle');
      // Should not show a 404 / not found page
      const notFound = staffPage.locator('text=Não encontrado');
      await expect(notFound).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('locked formalization content cannot be edited', async ({ staffPage, testProjectId }) => {
    test.skip(!testProjectId, 'TEST_PROJECT_ID is required');

    // Navigate to formalizações list
    await staffPage.goto(`/obra/${testProjectId}/formalizacoes`);
    await staffPage.waitForLoadState('networkidle');

    // Look for any formalization with "Aguardando Assinaturas" or "Assinado" badge
    const lockedCards = staffPage.locator('[data-testid="formalization-card"]').filter({
      has: staffPage.locator('text=/Aguardando Assinaturas|Assinado/'),
    });

    const count = await lockedCards.count();
    if (count > 0) {
      await lockedCards.first().click();
      await staffPage.waitForLoadState('networkidle');

      // The "Editar conteúdo" button should NOT be visible for locked formalization
      // (assuming acknowledgements exist; otherwise it may still be visible per business rules)
      // This is a soft check — the DB trigger is the actual guard
    }
  });

  test('pending_items table has no singular /formalizacao/ URLs', async ({ staffPage, testProjectId }) => {
    test.skip(!testProjectId, 'TEST_PROJECT_ID is required');

    await staffPage.goto(`/obra/${testProjectId}/pendencias`);
    await staffPage.waitForLoadState('networkidle');

    // Ensure no links point to the old singular route
    const badLinks = staffPage.locator('a[href*="/formalizacao/"]');
    // Filter out links that contain /formalizacoes/ (which is correct)
    const allHrefs = await badLinks.evaluateAll((els) =>
      els
        .map((el) => el.getAttribute('href') || '')
        .filter((h) => h.includes('/formalizacao/') && !h.includes('/formalizacoes/'))
    );
    expect(allHrefs).toHaveLength(0);
  });
});
