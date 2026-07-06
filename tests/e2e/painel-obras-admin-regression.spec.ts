import { test, expect, loginAs } from './fixtures/auth';

/**
 * Regressão: /gestao/painel-obras deve abrir sem crash ("Algo deu errado")
 * como admin em desktop (1280x900) e mobile (390x844), renderizando uma
 * lista real de obras. Cobre o bug histórico em que admins com muitos
 * projetos (89+) caíam no ErrorBoundary por causa de campos nulos.
 *
 * Requer variáveis:
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD (fallback para TEST_STAFF_*)
 */

const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ||
  process.env.TEST_STAFF_EMAIL ||
  'pedro.demo@bwild.com.br';
const ADMIN_PASSWORD =
  process.env.TEST_ADMIN_PASSWORD ||
  process.env.TEST_STAFF_PASSWORD ||
  '512451';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Painel de Obras — admin sem crash @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('carrega como admin e renderiza obras reais sem ErrorBoundary', async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      try {
        await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);

        await page.goto('/gestao/painel-obras');
        await page.waitForLoadState('networkidle').catch(() => undefined);

        // ErrorBoundary NÃO pode ter disparado.
        await expect(page.locator('text=/Algo deu errado/i')).toHaveCount(0);

        // Lista real: no desktop temos tabela; no mobile, cards.
        if (vp.name === 'desktop') {
          const rows = page.locator('[data-testid="painel-obras-row"]');
          await expect(rows.first()).toBeVisible({ timeout: 15_000 });
          expect(await rows.count()).toBeGreaterThan(0);
        } else {
          const cards = page.locator('button[aria-label^="Abrir obra"]');
          await expect(cards.first()).toBeVisible({ timeout: 15_000 });
          expect(await cards.count()).toBeGreaterThan(0);
        }

        // Nenhum erro fatal de runtime.
        expect(
          pageErrors,
          `Erros de página não esperados:\n${pageErrors.join('\n')}`,
        ).toHaveLength(0);

        // Ignora ruídos conhecidos (favicon, extensões); falha em erros reais.
        const fatalConsole = consoleErrors.filter(
          (t) =>
            !/favicon|Download the React DevTools|extension/i.test(t) &&
            /error|uncaught|cannot read|undefined is not/i.test(t),
        );
        expect(
          fatalConsole,
          `Erros de console não esperados:\n${fatalConsole.join('\n')}`,
        ).toHaveLength(0);
      } finally {
        await context.close();
      }
    });
  });
}
