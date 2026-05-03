import { test, expect, type Page } from './fixtures/auth';

/**
 * Verifica que a `entrega_oficial` mostrada no Painel de Obras coincide com
 * o MAX(planned_end) do Cronograma após edição/expansão, em desktop e mobile.
 *
 * Causa raiz histórica: `projects.planned_end_date` (lido pelo Painel) ficava
 * dessincronizado das atividades do cronograma. Hoje uma trigger garante a
 * sincronia (`trg_sync_project_planned_dates`); este teste é a regressão.
 *
 * Pré-condições: TEST_PROJECT_ID semeado com >= 1 atividade, login staff.
 */

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 720 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

/** Painel: lê o ISO da entrega oficial diretamente do data-attribute. */
async function getEntregaPainel(page: Page, projectId: string): Promise<string | null> {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle');
  const row = page.locator(`[data-testid="painel-obras-row"]`).filter({
    has: page.locator(`a[href*="/obra/${projectId}"], [href*="${projectId}"]`),
  }).first();
  // Fallback: se a linha específica não foi encontrada por link, abrir a obra
  // diretamente garante que ela existe; pulamos a granularidade aqui.
  const cell = row.locator('[data-testid="painel-obras-cell-entrega-oficial"]').first();
  await expect(cell).toBeVisible({ timeout: 15000 });
  const iso = await cell.getAttribute('data-entrega-oficial');
  return iso && iso.length > 0 ? iso : null;
}

/** Cronograma: pega o maior planned_end visível no formulário de edição. */
async function getMaxEntregaCronograma(page: Page, projectId: string): Promise<string | null> {
  await page.goto(`/obra/${projectId}/cronograma`);
  await page.waitForLoadState('networkidle');
  const isMobile = await page.evaluate(() => window.innerWidth < 768);
  const selector = isMobile
    ? '[data-testid="cronograma-activity-end-mobile"]'
    : '[data-testid="cronograma-activity-end"]';
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 15000 });
  const all = await page.locator(selector).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.plannedEnd ?? '').filter(Boolean),
  );
  if (all.length === 0) return null;
  // Ordena ISO YYYY-MM-DD lexicograficamente.
  return all.sort().slice(-1)[0];
}

for (const vp of VIEWPORTS) {
  test.describe(`Sync Painel ↔ Cronograma — ${vp.id}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('entrega_oficial do Painel = MAX(planned_end) do Cronograma', async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip(true, 'TEST_PROJECT_ID não configurado');
        return;
      }

      const painel = await getEntregaPainel(staffPage, testProjectId);
      const cron = await getMaxEntregaCronograma(staffPage, testProjectId);

      expect(
        painel,
        'entrega_oficial do Painel deve estar preenchida (trigger backfill garante sincronia)',
      ).not.toBeNull();
      expect(cron, 'cronograma deve ter ao menos uma atividade com planned_end').not.toBeNull();
      expect(painel).toBe(cron);
    });

    test('após editar a última atividade do cronograma, entrega oficial é atualizada no Painel', async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip(true, 'TEST_PROJECT_ID não configurado');
        return;
      }

      // Captura baseline.
      const before = await getMaxEntregaCronograma(staffPage, testProjectId);
      if (!before) {
        test.skip(true, 'Cronograma vazio — semeie atividades para o teste de edição');
        return;
      }

      // Avança em 7 dias.
      const next = (() => {
        const d = new Date(before + 'T00:00:00');
        d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
      })();

      // Edita a última linha. Em mobile e desktop o input de data é um
      // `<input type="text">` aceitando dd/mm/aaaa via DatePickerField; aqui
      // usamos a propriedade nativa para forçar o valor ISO via fill no
      // input subjacente do componente.
      const isMobile = vp.id === 'mobile';
      const wrapperSel = isMobile
        ? '[data-testid="cronograma-activity-end-mobile"]'
        : '[data-testid="cronograma-activity-end"]';
      const lastWrapper = staffPage.locator(wrapperSel).last();
      const input = lastWrapper.locator('input').first();
      await input.click();
      await input.fill('');
      const [yyyy, mm, dd] = next.split('-');
      await input.fill(`${dd}/${mm}/${yyyy}`);
      await input.press('Tab');

      // Salva.
      const saveBtn = staffPage.getByRole('button', { name: /Salvar|Save/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await staffPage.waitForLoadState('networkidle');
      }

      // Reabre o Painel e confirma propagação.
      await staffPage.waitForTimeout(800); // trigger + invalidação de cache
      const painelAfter = await getEntregaPainel(staffPage, testProjectId);
      const cronAfter = await getMaxEntregaCronograma(staffPage, testProjectId);

      expect(cronAfter, 'cronograma reflete edição').toBe(next);
      expect(painelAfter, 'Painel reflete a nova entrega após trigger de sync').toBe(cronAfter);
    });
  });
}
