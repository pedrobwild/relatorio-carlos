import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Visual snapshot tests para /gestao/painel-obras.
 *
 * Cobertura:
 *   1. Loading — skeleton da tabela (intercepta requests para nunca
 *      resolverem dentro do timeout do snapshot).
 *   2. Vazio   — tabela renderiza EmptyState (mock retorna `[]`).
 *   3. Dados reais — snapshot do estado normalmente carregado.
 *
 * Foco visual: cabeçalho da tabela (linha única, sem quebras) e a
 * coluna de ações (sticky à direita / botão "Mais ações"). Capturamos
 * apenas as regiões relevantes para evitar flakiness com o restante
 * da página.
 *
 * Para gerar baselines: `npx playwright test painel-obras-visual.spec.ts --update-snapshots`
 */

const DESKTOP = { width: 1280, height: 720 };

/** Bloqueia indefinidamente todas as chamadas Supabase REST/RPC. */
async function freezeBackend(page: Page) {
  await page.route('**/rest/v1/**', () => {
    /* never resolve — força estado de loading */
  });
}

/** Intercepta listagens-chave e devolve `[]` para forçar o EmptyState. */
async function emptyBackend(page: Page) {
  const empty = (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: '[]',
    });
  await page.route(/\/rest\/v1\/(projects|project_summaries|users_profile)/, empty);
  await page.route(/\/rest\/v1\/rpc\/get_user_projects_summary/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

async function gotoPainel(page: Page, opts: { waitNetworkIdle?: boolean } = {}) {
  await page.goto('/gestao/painel-obras');
  if (opts.waitNetworkIdle) {
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
}

test.describe('Painel de Obras — visual snapshots (desktop)', () => {
  test.use({ viewport: DESKTOP });

  test('loading: skeleton do cabeçalho e linhas', async ({ page }) => {
    await freezeBackend(page);
    await gotoPainel(page);

    const loadingRegion = page.locator('[aria-busy="true"][aria-label="Carregando obras"]').first();
    await expect(loadingRegion).toBeVisible({ timeout: 5_000 });

    await expect(loadingRegion).toHaveScreenshot('painel-obras-loading.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('vazio: EmptyState com cabeçalho preservado', async ({ page }) => {
    await emptyBackend(page);
    await gotoPainel(page, { waitNetworkIdle: true });

    // Aguarda o EmptyState (qualquer um — pode ser "sem obras" ou "sem acesso").
    const empty = page.locator('text=/Nenhuma obra|sem obras|Acesso restrito/i').first();
    await expect(empty).toBeVisible({ timeout: 8_000 });

    await expect(page).toHaveScreenshot('painel-obras-empty.png', {
      maxDiffPixelRatio: 0.03,
      fullPage: false,
      animations: 'disabled',
      mask: [page.locator('header'), page.locator('nav')],
    });
  });

  test('dados reais: cabeçalho da tabela em linha única', async ({ page }) => {
    await gotoPainel(page, { waitNetworkIdle: true });

    const header = page.locator('thead').first();
    if (!(await header.isVisible().catch(() => false))) {
      test.skip(true, 'Sem dados reais no ambiente — snapshot do header pulado');
    }

    await expect(header).toHaveScreenshot('painel-obras-header.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('dados reais: coluna de ações na primeira linha', async ({ page }) => {
    await gotoPainel(page, { waitNetworkIdle: true });

    const row = page.locator('[data-testid="painel-obras-row"]').first();
    const count = await page.locator('[data-testid="painel-obras-row"]').count();
    if (count === 0) {
      test.skip(true, 'Sem dados reais no ambiente — snapshot de ações pulado');
    }

    // Última célula = coluna de ações ("Abrir obra" + "Mais ações").
    const actionsCell = row.locator('td').last();
    await expect(actionsCell).toHaveScreenshot('painel-obras-actions-cell.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
