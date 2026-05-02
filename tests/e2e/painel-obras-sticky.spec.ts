import { test, expect, type Page } from '@playwright/test';

/**
 * Visual / behavioral checks for the sticky "Cliente / Obra" column in
 * /gestao/painel-obras. Validates that:
 *  - The column keeps its fixed width (240px) in mobile and desktop
 *  - The customer name is truncated (no wrap) when long
 *  - Expanding rows does NOT change the sticky column width
 *  - The Status column header stays visible (no collision/overlap)
 *
 * Companion checklist: docs/PAINEL_OBRAS_STICKY_QA.md
 *
 * Requires authenticated staff session and at least one project. If the
 * environment is not seeded, the spec is skipped gracefully.
 */

const STICKY_WIDTH = 240;

async function gotoPainel(page: Page) {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle');
}

async function getFirstRow(page: Page) {
  const row = page.locator('[data-testid="painel-obras-row"]').first();
  const count = await page.locator('[data-testid="painel-obras-row"]').count();
  if (count === 0) {
    test.skip(true, 'No projects available in environment to test sticky column');
  }
  return row;
}

async function getCellWidth(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().width);
}

test.describe('Painel de Obras — sticky "Cliente / Obra" column', () => {
  test.describe('Desktop (1280x720)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('header stays at fixed 240px and Status header is visible', async ({ page }) => {
      await gotoPainel(page);
      await getFirstRow(page);

      const clienteWidth = await getCellWidth(page, '[data-testid="painel-obras-th-cliente"]');
      expect(Math.round(clienteWidth)).toBe(STICKY_WIDTH);

      const statusHeader = page.locator('[data-testid="painel-obras-th-status"]');
      await expect(statusHeader).toBeVisible();
      await expect(statusHeader).toHaveText(/status/i);
    });

    test('customer name truncates with ellipsis (no wrap)', async ({ page }) => {
      await gotoPainel(page);
      const row = await getFirstRow(page);
      const cliente = row.locator('[data-testid="painel-obras-cell-cliente"]');

      const nameSpan = cliente.locator('span.truncate').first();
      const overflow = await nameSpan.evaluate((el) => getComputedStyle(el).textOverflow);
      const whiteSpace = await nameSpan.evaluate((el) => getComputedStyle(el).whiteSpace);

      expect(overflow).toBe('ellipsis');
      expect(whiteSpace).toBe('nowrap');
    });

    test('expanding row does NOT change sticky column width', async ({ page }) => {
      await gotoPainel(page);
      const row = await getFirstRow(page);

      const before = await getCellWidth(page, '[data-testid="painel-obras-cell-cliente"]');

      const toggle = row.locator('button[aria-label="Expandir detalhes"]');
      await toggle.click();
      await expect(row).toHaveAttribute('data-expanded', 'true');

      // Allow expansion content to render
      await page.waitForTimeout(300);

      const after = await getCellWidth(page, '[data-testid="painel-obras-cell-cliente"]');

      expect(Math.round(before)).toBe(STICKY_WIDTH);
      expect(Math.round(after)).toBe(STICKY_WIDTH);
      expect(Math.abs(after - before)).toBeLessThan(1);
    });
  });

  // ── Mobile (< md): a tabela densa foi substituída por uma listagem em
  //    cards (`MobilePainelView`). As assertivas de coluna sticky deixam de
  //    fazer sentido — agora validamos que (a) a tabela está oculta, (b) a
  //    lista de cards aparece sem scroll horizontal acidental, (c) o topo
  //    expõe busca + botão "Filtros" como ação primária da viewport.
  test.describe('Mobile (375x812) — cards empilhados', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('table is hidden and mobile card list renders without horizontal scroll', async ({ page }) => {
      await gotoPainel(page);

      // Cards mobile devem estar presentes (link com aria-label "Abrir obra…").
      const cards = page.locator('button[aria-label^="Abrir obra"]');
      const cardCount = await cards.count();
      if (cardCount === 0) {
        test.skip(true, 'No projects available in environment to test mobile cards');
      }
      await expect(cards.first()).toBeVisible();

      // Tabela desktop não pode estar visível no mobile.
      await expect(page.locator('[data-testid="painel-obras-th-cliente"]')).toBeHidden();

      // Sem overflow horizontal acidental.
      const docOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(docOverflow.scrollWidth).toBeLessThanOrEqual(docOverflow.clientWidth + 1);
    });

    test('top exposes search + Filtros as primary actions', async ({ page }) => {
      await gotoPainel(page);

      const search = page.getByLabel('Buscar obras');
      await expect(search).toBeVisible();

      const filtersButton = page.getByRole('button', { name: /Filtros|filtros/i });
      await expect(filtersButton.first()).toBeVisible();
    });
  });
});
