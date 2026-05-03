import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke suite for /gestao/painel-obras.
 *
 * Verifica que o painel executivo continua íntegro após interações comuns:
 *   1. Carrega a rota sem crash e mostra a tabela.
 *   2. Aplica busca + filtros (status/etapa) e mantém o layout (sem
 *      overflow vertical no header, sticky column intacta).
 *   3. Ordena por uma coluna clicável e preserva o cabeçalho em linha única.
 *   4. Expande uma linha (DailyLog inline) sem alterar a largura da coluna
 *      sticky "Cliente / Obra".
 *   5. Abre o menu "Mais ações" (editar/excluir) e fecha sem disparar
 *      operações destrutivas.
 *
 * Requer sessão de staff autenticada e ao menos uma obra. Caso o ambiente
 * não esteja semeado, os testes são pulados graciosamente.
 *
 * Companion: docs/PAINEL_OBRAS_REGRESSAO.md
 */

const STICKY_WIDTH = 240;

async function gotoPainel(page: Page) {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle');
}

async function ensureRows(page: Page) {
  const rows = page.locator('[data-testid="painel-obras-row"]');
  const count = await rows.count();
  if (count === 0) {
    test.skip(true, 'No projects available — seed required for painel smoke');
  }
  return rows;
}

async function getStickyWidth(page: Page) {
  return page
    .locator('[data-testid="painel-obras-th-cliente"]')
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
}

test.describe('Painel de Obras — smoke (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('1. carrega tabela e cabeçalhos não quebram em múltiplas linhas', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const headerRow = page.locator('thead tr').first();
    await expect(headerRow).toBeVisible();

    // Header em linha única: altura ~ uma linha (< 60px).
    const headerHeight = await headerRow.evaluate((el) => el.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(60);

    await expect(page.locator('[data-testid="painel-obras-th-cliente"]')).toBeVisible();
    await expect(page.locator('[data-testid="painel-obras-th-status"]')).toBeVisible();
    expect(await getStickyWidth(page)).toBe(STICKY_WIDTH);
  });

  test('2. aplicar busca e filtros mantém o layout do painel', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const widthBefore = await getStickyWidth(page);

    // Busca livre
    const search = page.getByLabel('Buscar', { exact: false }).first();
    await search.fill('a');
    await page.waitForTimeout(300);

    // Filtro de status (combobox)
    const statusFilter = page.getByLabel('Filtrar por status').first();
    if (await statusFilter.isVisible().catch(() => false)) {
      await statusFilter.click();
      const option = page.getByRole('option').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    await page.waitForTimeout(300);

    // Sticky preservado, sem overflow vertical no header.
    expect(await getStickyWidth(page)).toBe(widthBefore);
    const headerHeight = await page
      .locator('thead tr')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(60);
  });

  test('3. ordenar por coluna mantém cabeçalho em linha única', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const sortBtn = page.locator('button[aria-label^="Ordenar por"]').first();
    if (!(await sortBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No sortable column header found');
    }
    await sortBtn.click();
    await page.waitForTimeout(200);
    await sortBtn.click(); // toggle direction
    await page.waitForTimeout(200);

    const headerHeight = await page
      .locator('thead tr')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(60);
    expect(await getStickyWidth(page)).toBe(STICKY_WIDTH);
  });

  test('4. expandir linha não altera a largura da coluna sticky', async ({ page }) => {
    await gotoPainel(page);
    const rows = await ensureRows(page);
    const row = rows.first();

    const before = await getStickyWidth(page);

    const toggle = row.locator('button[aria-label="Expandir detalhes"]');
    await toggle.click();
    await expect(row).toHaveAttribute('data-expanded', 'true');
    await page.waitForTimeout(300);

    const after = await getStickyWidth(page);
    expect(after).toBe(before);

    // Linha expandida renderizada logo abaixo
    await expect(page.locator('[data-testid="painel-obras-row-expanded"]').first()).toBeVisible();

    // Recolhe para deixar o estado limpo
    await toggle.click();
    await expect(row).toHaveAttribute('data-expanded', 'false');
  });

  test('5. menu "Mais ações" (editar/excluir) abre sem quebrar o layout', async ({ page }) => {
    await gotoPainel(page);
    const rows = await ensureRows(page);
    const row = rows.first();

    const moreBtn = row.locator('button[aria-label="Mais ações"]');
    if (!(await moreBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Row actions menu not present in this environment');
    }
    await moreBtn.click();

    // Menu deve expor ações (editar / excluir) sem disparar mutação.
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const editar = page.getByRole('menuitem', { name: /editar/i });
    const excluir = page.getByRole('menuitem', { name: /excluir|remover/i });
    await expect(editar.or(excluir).first()).toBeVisible();

    // Fecha sem clicar — não dispara delete.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Layout segue íntegro.
    expect(await getStickyWidth(page)).toBe(STICKY_WIDTH);
    const headerHeight = await page
      .locator('thead tr')
      .first()
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(headerHeight).toBeLessThan(60);
  });
});
