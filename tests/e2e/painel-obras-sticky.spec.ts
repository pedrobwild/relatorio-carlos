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

  test.describe('Mobile (375x812)', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('sticky column keeps 240px even on small viewport', async ({ page }) => {
      await gotoPainel(page);
      await getFirstRow(page);

      const clienteWidth = await getCellWidth(page, '[data-testid="painel-obras-th-cliente"]');
      expect(Math.round(clienteWidth)).toBe(STICKY_WIDTH);
    });

    test('expanding row in mobile does not collapse adjacent columns', async ({ page }) => {
      await gotoPainel(page);
      const row = await getFirstRow(page);

      const widthBefore = await getCellWidth(page, '[data-testid="painel-obras-cell-cliente"]');
      const statusBefore = await getCellWidth(page, '[data-testid="painel-obras-th-status"]');

      await row.locator('button[aria-label="Expandir detalhes"]').click();
      await expect(row).toHaveAttribute('data-expanded', 'true');
      await page.waitForTimeout(300);

      const widthAfter = await getCellWidth(page, '[data-testid="painel-obras-cell-cliente"]');
      const statusAfter = await getCellWidth(page, '[data-testid="painel-obras-th-status"]');

      expect(Math.round(widthAfter)).toBe(STICKY_WIDTH);
      // Status column should not collapse below its declared min-width (120px)
      expect(statusAfter).toBeGreaterThanOrEqual(120 - 1);
      expect(Math.abs(statusAfter - statusBefore)).toBeLessThan(2);
      expect(Math.abs(widthAfter - widthBefore)).toBeLessThan(1);
    });
  });
});
