import { test, expect } from './fixtures/auth';

/**
 * E2E mobile — Cronograma resiliente a mudança de orientação e zoom.
 *
 * Verifica que ao alternar entre portrait (390×844) e landscape (844×390)
 * e ao aplicar zoom in/out (browser zoom simulado via CSS), o layout do
 * Cronograma não quebra:
 * - Sem overflow horizontal acidental.
 * - Os controles principais (Início Previsto, Término Previsto, Dias úteis,
 *   Aplicar duração, Recalcular semana a semana) continuam visíveis e operáveis.
 * - O scroll vertical da página segue funcionando.
 */
test.describe('EditarObra mobile — Orientação e zoom no Cronograma', () => {
  const PORTRAIT = { width: 390, height: 844 };
  const LANDSCAPE = { width: 844, height: 390 };

  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(PORTRAIT);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'Página não deve ter overflow horizontal').toBeLessThanOrEqual(1);
  }

  async function expectVerticalScrollWorks(page: import('@playwright/test').Page) {
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.scrollY);
    expect(after, 'Scroll vertical deve avançar').toBeGreaterThan(before);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  test('alternar portrait → landscape → portrait mantém layout e scroll', async ({ staffPage }) => {
    // Portrait baseline
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await expectNoHorizontalOverflow(staffPage);

    // Landscape
    await staffPage.setViewportSize(LANDSCAPE);
    await staffPage.waitForTimeout(200);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible();
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await expect(duracao).toBeEnabled();
    await expect(staffPage.getByRole('button', { name: /Aplicar duração/i })).toBeVisible();
    await expectNoHorizontalOverflow(staffPage);
    await expectVerticalScrollWorks(staffPage);

    // Volta para portrait
    await staffPage.setViewportSize(PORTRAIT);
    await staffPage.waitForTimeout(200);
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await expectNoHorizontalOverflow(staffPage);
    await expectVerticalScrollWorks(staffPage);
  });

  test('controles permanecem operáveis em landscape (preencher e aplicar)', async ({ staffPage }) => {
    await staffPage.setViewportSize(LANDSCAPE);
    await staffPage.waitForTimeout(200);

    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.scrollIntoViewIfNeeded();
    await startInput.fill('2026-05-04');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await duracao.fill('20');

    const aplicar = staffPage.getByRole('button', { name: /Aplicar duração/i });
    await expect(aplicar).toBeEnabled();
    await aplicar.tap();

    const endInput = staffPage.locator('input[type="date"]').nth(1);
    await expect(endInput).toHaveValue('2026-05-29', { timeout: 5000 });

    await expectNoHorizontalOverflow(staffPage);
  });

  test('zoom in (1.5×) não quebra layout nem o scroll vertical', async ({ staffPage }) => {
    // Simula zoom do browser ampliando o body via CSS transform
    await staffPage.evaluate(() => {
      const b = document.body;
      b.style.transformOrigin = '0 0';
      b.style.transform = 'scale(1.5)';
      b.style.width = `${100 / 1.5}%`;
    });
    await staffPage.waitForTimeout(150);

    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible();
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();

    await expectNoHorizontalOverflow(staffPage);
    await expectVerticalScrollWorks(staffPage);

    // Reset
    await staffPage.evaluate(() => {
      document.body.style.transform = '';
      document.body.style.width = '';
    });
  });

  test('zoom out (0.75×) mantém controles visíveis e sem overflow', async ({ staffPage }) => {
    await staffPage.evaluate(() => {
      const b = document.body;
      b.style.transformOrigin = '0 0';
      b.style.transform = 'scale(0.75)';
      b.style.width = `${100 / 0.75}%`;
    });
    await staffPage.waitForTimeout(150);

    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await expect(staffPage.getByRole('button', { name: /Aplicar duração/i })).toBeVisible();

    await expectNoHorizontalOverflow(staffPage);

    await staffPage.evaluate(() => {
      document.body.style.transform = '';
      document.body.style.width = '';
    });
  });

  test('combo: zoom 1.25× em landscape mantém recálculo acessível (quando presente)', async ({ staffPage }) => {
    await staffPage.setViewportSize(LANDSCAPE);
    await staffPage.evaluate(() => {
      const b = document.body;
      b.style.transformOrigin = '0 0';
      b.style.transform = 'scale(1.25)';
      b.style.width = `${100 / 1.25}%`;
    });
    await staffPage.waitForTimeout(200);

    const recalcBtn = staffPage.getByRole('button', {
      name: /Pré-visualizar recálculo|Recalcular semana a semana/i,
    });
    if (await recalcBtn.isVisible().catch(() => false)) {
      await recalcBtn.scrollIntoViewIfNeeded();
      await expect(recalcBtn).toBeVisible();
      const box = await recalcBtn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
    }

    await expectNoHorizontalOverflow(staffPage);
    await expectVerticalScrollWorks(staffPage);

    await staffPage.evaluate(() => {
      document.body.style.transform = '';
      document.body.style.width = '';
    });
  });
});
