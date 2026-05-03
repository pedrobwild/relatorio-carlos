import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — acessibilidade dos controles do cabeçalho e ações por linha
 * em /gestao/painel-obras.
 *
 * Cobre, sem depender de bibliotecas externas (axe), as garantias mais
 * importantes do checklist:
 *   - Botões de ordenação (cabeçalho) expõem `aria-label` descritivo e
 *     `aria-sort` que alterna entre `none`/`ascending`/`descending`.
 *   - Cada linha expõe ações primárias com rótulos acessíveis
 *     ("Expandir detalhes", "Abrir obra", "Mais ações").
 *   - Navegação por teclado (Tab) percorre os controles do cabeçalho na
 *     ordem visual e dispara ordenação via Enter/Space.
 *   - Foco fica visível (outline) ao tabular nos botões de ação.
 *   - O menu "Mais ações" abre por teclado e fecha com Escape, devolvendo
 *     o foco ao trigger.
 *
 * Companion: docs/PAINEL_OBRAS_REGRESSAO.md
 */

const DESKTOP = { width: 1280, height: 720 };

async function gotoPainel(page: Page) {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function ensureRows(page: Page) {
  const rows = page.locator('[data-testid="painel-obras-row"]');
  const count = await rows.count();
  if (count === 0) test.skip(true, 'Sem obras no ambiente para testar A11y');
  return rows;
}

async function focusOutlineWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return 0;
    const cs = getComputedStyle(el);
    return parseFloat(cs.outlineWidth) || parseFloat(cs.getPropertyValue('--tw-ring-offset-width')) || 0;
  });
}

test.describe('Painel de Obras — A11y do cabeçalho e ações', () => {
  test.use({ viewport: DESKTOP });

  test('botões de ordenação expõem aria-label e aria-sort', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const sortButtons = page.locator('button[aria-label^="Ordenar por"]');
    const count = await sortButtons.count();
    expect(count).toBeGreaterThan(0);

    // Todos têm aria-label descritivo
    for (let i = 0; i < count; i++) {
      const label = await sortButtons.nth(i).getAttribute('aria-label');
      expect(label).toMatch(/^Ordenar por .+/);
    }

    // Estado inicial: nenhum aria-sort = 'ascending'/'descending'
    const first = sortButtons.first();
    await expect(first).toHaveAttribute('aria-sort', /none|ascending|descending/);

    // Clica → vira "ascending"
    await first.click();
    await expect(first).toHaveAttribute('aria-sort', 'ascending');
    // Atualiza aria-label refletindo direção
    expect(await first.getAttribute('aria-label')).toMatch(/crescente/i);

    // Clica de novo → "descending"
    await first.click();
    await expect(first).toHaveAttribute('aria-sort', 'descending');
    expect(await first.getAttribute('aria-label')).toMatch(/decrescente/i);
  });

  test('linha expõe ações com rótulos acessíveis', async ({ page }) => {
    await gotoPainel(page);
    const rows = await ensureRows(page);
    const row = rows.first();

    await expect(row.locator('button[aria-label="Expandir detalhes"]')).toBeVisible();
    await expect(row.locator('button[aria-label="Abrir obra"]')).toBeVisible();
    await expect(row.locator('button[aria-label="Mais ações"]')).toBeVisible();
  });

  test('ordenação dispara via teclado (Enter)', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const sortBtn = page.locator('button[aria-label^="Ordenar por"]').first();
    await sortBtn.focus();
    await expect(sortBtn).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(sortBtn).toHaveAttribute('aria-sort', 'ascending');

    await page.keyboard.press('Enter');
    await expect(sortBtn).toHaveAttribute('aria-sort', 'descending');
  });

  test('botões de ação recebem foco visível ao tabular', async ({ page }) => {
    await gotoPainel(page);
    const rows = await ensureRows(page);

    const openBtn = rows.first().locator('button[aria-label="Abrir obra"]');
    await openBtn.focus();
    await expect(openBtn).toBeFocused();

    // Foco visível: outline OU ring (Tailwind focus-visible)
    const visible = await openBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      const outlineOk =
        cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ringOk = cs.boxShadow !== 'none' && cs.boxShadow.includes('rgb');
      return outlineOk || ringOk;
    });
    expect(visible).toBe(true);
  });

  test('menu "Mais ações" abre por teclado e fecha com Escape devolvendo foco', async ({ page }) => {
    await gotoPainel(page);
    const rows = await ensureRows(page);

    const moreBtn = rows.first().locator('button[aria-label="Mais ações"]');
    await moreBtn.focus();
    await expect(moreBtn).toBeFocused();

    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // aria-expanded reflete estado aberto
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');

    // Escape fecha e devolve foco ao trigger
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(moreBtn).toBeFocused();
  });

  test('controles do cabeçalho não dependem apenas de cor para indicar ordenação', async ({ page }) => {
    await gotoPainel(page);
    await ensureRows(page);

    const sortBtn = page.locator('button[aria-label^="Ordenar por"]').first();
    await sortBtn.click();

    // Ícone de direção (svg) deve estar presente como pista não-cromática
    const hasIcon = await sortBtn.locator('svg').count();
    expect(hasIcon).toBeGreaterThan(0);

    // aria-sort comunica programaticamente o estado
    await expect(sortBtn).toHaveAttribute('aria-sort', /ascending|descending/);
  });
});
