import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — em viewports < 768px, /gestao/painel-obras deve esconder a tabela
 * densa (desktop) e renderizar o `MobilePainelView` em formato de cards,
 * preservando busca, filtros (via sheet) e ordenação.
 *
 * Companion: docs/PAINEL_OBRAS_REGRESSAO.md
 */

const MOBILE_BREAKPOINTS = [
  { name: 'small',  width: 360, height: 800 },
  { name: 'iphone', width: 375, height: 812 },
  { name: 'large',  width: 414, height: 896 },
] as const;

async function gotoPainel(page: Page) {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function ensureCards(page: Page) {
  const cards = page.locator('button[aria-label^="Abrir obra"]');
  const count = await cards.count();
  if (count === 0) test.skip(true, 'Sem obras no ambiente para testar mobile');
  return cards;
}

for (const bp of MOBILE_BREAKPOINTS) {
  test.describe(`Painel de Obras — mobile cards @ ${bp.name} (${bp.width}px)`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } });

    test('tabela desktop está oculta e MobilePainelView renderiza', async ({ page }) => {
      await gotoPainel(page);
      await ensureCards(page);

      // Tabela densa não deve estar visível
      await expect(page.locator('[data-testid="painel-obras-th-cliente"]')).toBeHidden();
      await expect(page.locator('thead')).toBeHidden();

      // Topo mobile expõe busca + botão Filtros
      await expect(page.getByLabel('Buscar obras')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Filtros|Abrir filtros|Filtros \(/ })).toBeVisible();
    });

    test('sem overflow horizontal e sem sobreposição da topbar', async ({ page }) => {
      await gotoPainel(page);
      await ensureCards(page);

      // Sem rolagem horizontal acidental
      const overflow = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 1);

      // Topbar sticky (busca + Filtros) não pode sobrepor o primeiro card
      const search = page.getByLabel('Buscar obras');
      const firstCard = page.locator('button[aria-label^="Abrir obra"]').first();
      const searchBox = await search.boundingBox();
      const cardBox = await firstCard.boundingBox();
      expect(searchBox && cardBox).toBeTruthy();
      if (searchBox && cardBox) {
        // O card começa abaixo da topbar (sem sobreposição)
        expect(cardBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height - 1);
      }
    });

    test('busca filtra a lista de cards', async ({ page }) => {
      await gotoPainel(page);
      const cards = await ensureCards(page);
      const before = await cards.count();

      const search = page.getByLabel('Buscar obras');
      await search.fill('zzz_no_match_query_xyz');
      await page.waitForTimeout(400);

      // Lista deve ficar vazia ou reduzir
      const after = await page.locator('button[aria-label^="Abrir obra"]').count();
      expect(after).toBeLessThan(before);

      // Empty state aparece quando 0 resultados
      if (after === 0) {
        await expect(page.locator('text=/Nenhum resultado|Nenhuma obra/i').first()).toBeVisible();
      }

      // Limpa busca
      const clearBtn = page.getByLabel('Limpar busca');
      if (await clearBtn.isVisible().catch(() => false)) {
        await clearBtn.click();
      } else {
        await search.fill('');
      }
      await page.waitForTimeout(300);
      const restored = await page.locator('button[aria-label^="Abrir obra"]').count();
      expect(restored).toBe(before);
    });

    test('botão Filtros abre o sheet com ordenação e filtros funcionais', async ({ page }) => {
      await gotoPainel(page);
      await ensureCards(page);

      const filtersBtn = page
        .getByRole('button', { name: /^Filtros|Abrir filtros|Filtros \(/ })
        .first();
      await filtersBtn.click();

      // Sheet/dialog visível
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Deve conter algum controle de ordenação (label "Ordenar") e/ou
      // filtros conhecidos (Status / Etapa / Relacionamento / Responsável).
      const hasSort = await dialog.locator('text=/ordenar/i').first().isVisible().catch(() => false);
      const hasStatus = await dialog.locator('text=/status/i').first().isVisible().catch(() => false);
      const hasEtapa = await dialog.locator('text=/etapa/i').first().isVisible().catch(() => false);
      expect(hasSort || hasStatus || hasEtapa).toBe(true);

      // Fecha sem aplicar (Escape) — não pode disparar mutação ou ficar travado.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 3_000 });
    });
  });
}
