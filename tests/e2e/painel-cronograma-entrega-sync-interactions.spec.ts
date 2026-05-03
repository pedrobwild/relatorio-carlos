import { test, expect, type Page } from './fixtures/auth';

/**
 * Cenários de regressão extras para a sincronia entre `entrega_oficial`
 * (Painel de Obras) e MAX(planned_end) do Cronograma:
 *  - Após expandir/recolher os grupos do cronograma (mobile) ou linhas
 *    do cronograma (desktop), a data exposta no DOM permanece a mesma e
 *    continua igual à do Painel.
 *  - Após abrir e fechar o modal/sheet de detalhes de atividade
 *    (proxy do "modal de recálculo": edição que dispara recomputação
 *    via trigger no banco), a sincronia continua intacta.
 */

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 720 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

async function getEntregaPainel(page: Page, projectId: string): Promise<string | null> {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle');
  const cell = page
    .locator('[data-testid="painel-obras-cell-entrega-oficial"]')
    .first();
  await expect(cell).toBeVisible({ timeout: 15000 });
  const iso = await cell.getAttribute('data-entrega-oficial');
  return iso && iso.length > 0 ? iso : null;
}

async function readMaxPlannedEnd(page: Page): Promise<string | null> {
  const isMobile = await page.evaluate(() => window.innerWidth < 768);
  const sel = isMobile
    ? '[data-testid="cronograma-activity-end-mobile"]'
    : '[data-testid="cronograma-activity-end"]';
  await expect(page.locator(sel).first()).toBeVisible({ timeout: 15000 });
  const all = await page.locator(sel).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.plannedEnd ?? '').filter(Boolean),
  );
  return all.length === 0 ? null : all.sort().slice(-1)[0];
}

for (const vp of VIEWPORTS) {
  test.describe(`Sincronia após interações UI — ${vp.id}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('expandir/recolher grupos do cronograma não altera a data e mantém sincronia com Painel', async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip(true, 'TEST_PROJECT_ID não configurado');
        return;
      }

      await staffPage.goto(`/obra/${testProjectId}/cronograma`);
      await staffPage.waitForLoadState('networkidle');

      const before = await readMaxPlannedEnd(staffPage);
      expect(before, 'cronograma deve ter atividades').not.toBeNull();

      // Colapsa e re-expande qualquer trigger de Collapsible visível
      // (Radix expõe role="button" + aria-expanded em CollapsibleTrigger).
      const triggers = staffPage.locator('[aria-expanded]');
      const count = Math.min(await triggers.count(), 3);
      for (let i = 0; i < count; i++) {
        const t = triggers.nth(i);
        if (await t.isVisible().catch(() => false)) {
          await t.click({ trial: false }).catch(() => {});
          await staffPage.waitForTimeout(150);
          await t.click().catch(() => {});
          await staffPage.waitForTimeout(150);
        }
      }

      const after = await readMaxPlannedEnd(staffPage);
      expect(after, 'data MAX(planned_end) deve permanecer estável').toBe(before);

      const painel = await getEntregaPainel(staffPage, testProjectId);
      expect(painel, 'Painel ↔ Cronograma seguem sincronizados').toBe(after);
    });

    test('abrir e fechar o detalhe/edição da atividade preserva a sincronia', async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip(true, 'TEST_PROJECT_ID não configurado');
        return;
      }

      await staffPage.goto(`/obra/${testProjectId}/cronograma`);
      await staffPage.waitForLoadState('networkidle');
      const before = await readMaxPlannedEnd(staffPage);
      expect(before).not.toBeNull();

      // Tenta abrir o primeiro item de atividade (linha/cartão clicável).
      // Em ambos breakpoints, o wrapper de end é filho do bloco editável.
      const isMobile = vp.id === 'mobile';
      const wrapperSel = isMobile
        ? '[data-testid="cronograma-activity-end-mobile"]'
        : '[data-testid="cronograma-activity-end"]';
      const lastWrapper = staffPage.locator(wrapperSel).last();
      await lastWrapper.scrollIntoViewIfNeeded();
      // Sobe para um ancestral clicável (botão/cartão/linha)
      const clickableAncestor = lastWrapper.locator(
        'xpath=ancestor::*[self::button or @role="button" or contains(@class,"cursor-pointer")][1]',
      );
      if (await clickableAncestor.count()) {
        await clickableAncestor.first().click().catch(() => {});
        await staffPage.waitForTimeout(300);
        // Fecha por Escape (cobre Dialog/Sheet/Popover).
        await staffPage.keyboard.press('Escape');
        await staffPage.waitForTimeout(300);
      }

      const after = await readMaxPlannedEnd(staffPage);
      expect(after, 'abertura/fechamento sem edição não altera a data').toBe(before);

      const painel = await getEntregaPainel(staffPage, testProjectId);
      expect(painel, 'Painel ↔ Cronograma seguem sincronizados').toBe(after);
    });
  });
}
