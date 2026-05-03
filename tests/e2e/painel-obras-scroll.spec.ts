import { test, expect, type Page } from '@playwright/test';

/**
 * E2E — integridade de scroll do Painel de Obras em múltiplos breakpoints.
 *
 * Valida, para cada viewport (mobile, tablet, desktop, wide):
 *   - Cabeçalho da tabela (ou cards mobile) renderiza sem quebra em
 *     múltiplas linhas (altura da linha do header < 60px).
 *   - Coluna de ações ("Abrir obra" + "Mais ações") permanece visível
 *     ao final do scroll horizontal.
 *   - Não há overflow horizontal acidental no `<html>` (a rolagem
 *     horizontal deve estar restrita ao container da tabela).
 *   - Após scroll horizontal, a coluna sticky "Cliente / Obra" segue
 *     ancorada à esquerda.
 *   - Após scroll vertical, o header da tabela permanece visível
 *     (sticky top) e nenhuma linha "vaza" sobre o header.
 *
 * Companion: docs/PAINEL_OBRAS_REGRESSAO.md
 */

const BREAKPOINTS = [
  { name: 'mobile',  width: 375,  height: 812 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'wide',    width: 1920, height: 1080 },
] as const;

async function gotoPainel(page: Page) {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function hasDesktopTable(page: Page): Promise<boolean> {
  return page
    .locator('[data-testid="painel-obras-th-cliente"]')
    .first()
    .isVisible()
    .catch(() => false);
}

async function getHtmlOverflow(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

for (const bp of BREAKPOINTS) {
  test.describe(`Painel de Obras — scroll integrity @ ${bp.name} (${bp.width}x${bp.height})`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } });

    test('html não tem overflow horizontal acidental', async ({ page }) => {
      await gotoPainel(page);
      const { scrollWidth, clientWidth } = await getHtmlOverflow(page);
      // Tolerância de 1px para arredondamentos
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test('cabeçalho permanece em linha única (sem quebra vertical)', async ({ page }) => {
      await gotoPainel(page);

      if (!(await hasDesktopTable(page))) {
        // Em mobile a tabela é substituída por cards; valida que cards
        // renderizam sem overflow horizontal próprio.
        const cards = page.locator('button[aria-label^="Abrir obra"]');
        const count = await cards.count();
        if (count === 0) test.skip(true, 'Sem dados para testar cards mobile');
        await expect(cards.first()).toBeVisible();
        return;
      }

      const headerRow = page.locator('thead tr').first();
      await expect(headerRow).toBeVisible();
      const headerHeight = await headerRow.evaluate((el) => el.getBoundingClientRect().height);
      expect(headerHeight).toBeLessThan(60);

      // Cada <th> deve permanecer com whitespace-nowrap (1 linha de texto).
      const thHeights = await page.locator('thead th').evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().height),
      );
      for (const h of thHeights) {
        expect(h).toBeLessThan(60);
      }
    });

    test('coluna de ações fica acessível após scroll horizontal', async ({ page }) => {
      await gotoPainel(page);
      if (!(await hasDesktopTable(page))) {
        test.skip(true, 'Cards mobile não possuem coluna sticky de ações');
      }

      const rows = page.locator('[data-testid="painel-obras-row"]');
      const rowCount = await rows.count();
      if (rowCount === 0) test.skip(true, 'Sem obras no ambiente para testar scroll');

      // Container scrollável da tabela
      const scroller = page.locator('thead').first().locator('xpath=ancestor::div[contains(@class, "overflow")][1]');

      // Rola até o final do scroll horizontal
      await scroller.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await page.waitForTimeout(150);

      // Botão "Abrir obra" da última coluna deve permanecer visível
      const openBtn = rows.first().locator('button[aria-label="Abrir obra"]');
      await expect(openBtn).toBeVisible();

      // Coluna sticky "Cliente / Obra" deve continuar ancorada à esquerda
      const stickyLeft = await page
        .locator('[data-testid="painel-obras-th-cliente"]')
        .first()
        .evaluate((el) => el.getBoundingClientRect().left);
      const containerLeft = await scroller.evaluate((el) => el.getBoundingClientRect().left);
      // Tolerância de 4px para borda/sombra
      expect(Math.abs(stickyLeft - containerLeft)).toBeLessThan(4);
    });

    test('cabeçalho da tabela permanece visível após scroll vertical', async ({ page }) => {
      await gotoPainel(page);
      if (!(await hasDesktopTable(page))) {
        test.skip(true, 'Mobile não usa header sticky de tabela');
      }

      const rows = page.locator('[data-testid="painel-obras-row"]');
      const rowCount = await rows.count();
      if (rowCount < 3) test.skip(true, 'Poucas linhas para validar scroll vertical');

      const header = page.locator('[data-testid="painel-obras-th-cliente"]').first();
      const beforeTop = await header.evaluate((el) => el.getBoundingClientRect().top);

      // Scroll vertical na janela e no container
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(200);

      // Header continua visível
      await expect(header).toBeVisible();
      const afterTop = await header.evaluate((el) => el.getBoundingClientRect().top);

      // O top pode mudar ligeiramente devido ao layout sticky, mas não deve
      // desaparecer da viewport (top dentro de [0, viewport.height)).
      expect(afterTop).toBeGreaterThanOrEqual(0);
      expect(afterTop).toBeLessThan(bp.height);
      // E não deve ter "saltado" para fora (sanity check vs estado inicial)
      expect(Math.abs(afterTop - beforeTop)).toBeLessThan(bp.height);
    });
  });
}
