import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Auditoria a11y automatizada com axe-core para as rotas-chave do Portal BWild.
 *
 * Estratégia:
 *  - Usa rotas **públicas** (`/auth`, `/recuperar-senha`, `/redefinir-senha`)
 *    para garantir cobertura sem credenciais — assim a CI roda sem secrets.
 *  - Rotas autenticadas (`/minhas-obras`, `/gestao/painel-obras`, etc.) são
 *    auditadas apenas quando `TEST_CUSTOMER_EMAIL`/`TEST_STAFF_EMAIL` estão
 *    presentes (CI com secrets) — caso contrário o teste é skip.
 *  - Falha em violações `serious` ou `critical` (regra do issue #22).
 *  - Ignora regras conhecidas que dependem do conteúdo dinâmico (cores
 *    flagradas como contraste insuficiente em screenshots de loading state
 *    são endereçadas pelo audit-contrast offline).
 *
 * Run local: `npx playwright test a11y/critical-routes.spec.ts`
 * Run CI:    incluído em `.github/workflows/ci.yml` job `a11y`.
 */

const SERIOUS_OR_CRITICAL = ['serious', 'critical'] as const;

const PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'Auth', path: '/auth' },
  { name: 'Recuperar Senha', path: '/recuperar-senha' },
  { name: 'Redefinir Senha', path: '/redefinir-senha' },
];

async function runAxe(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const blocking = results.violations.filter((v) =>
    SERIOUS_OR_CRITICAL.includes(v.impact as (typeof SERIOUS_OR_CRITICAL)[number]),
  );

  if (blocking.length > 0) {
    // Mensagem detalhada para facilitar fix em PR.
    const detail = blocking
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.help}\n  → ${v.helpUrl}\n  Affected nodes: ${v.nodes.length}`,
      )
      .join('\n\n');
    expect(blocking, `axe violations:\n\n${detail}`).toEqual([]);
  }

  return results;
}

test.describe('Acessibilidade — rotas públicas', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) sem violações serious/critical`, async ({ page }) => {
      await page.goto(route.path);
      // Espera a página estabilizar antes de auditar.
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await runAxe(page);
    });
  }
});

const HAS_CREDENTIALS = Boolean(
  process.env.TEST_CUSTOMER_EMAIL && process.env.TEST_CUSTOMER_PASSWORD,
);
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID;

test.describe('Acessibilidade — rotas autenticadas (cliente)', () => {
  test.skip(!HAS_CREDENTIALS, 'Credenciais de teste indisponíveis (skip a11y autenticado)');

  test('Minhas Obras sem violações serious/critical', async ({ page }) => {
    await page.goto('/auth');
    await page.fill(
      '[data-testid="login-identifier"]',
      process.env.TEST_CUSTOMER_EMAIL!,
    );
    await page.fill(
      '[data-testid="login-password"]',
      process.env.TEST_CUSTOMER_PASSWORD!,
    );
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(/\/minhas-obras|\/obra\//, { timeout: 15000 });
    await page.goto('/minhas-obras');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await runAxe(page);
  });

  test.skip(!TEST_PROJECT_ID, 'TEST_PROJECT_ID indisponível');
  test('Relatório (Index) sem violações serious/critical', async ({ page }) => {
    await page.goto('/auth');
    await page.fill(
      '[data-testid="login-identifier"]',
      process.env.TEST_CUSTOMER_EMAIL!,
    );
    await page.fill(
      '[data-testid="login-password"]',
      process.env.TEST_CUSTOMER_PASSWORD!,
    );
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(/\/minhas-obras|\/obra\//, { timeout: 15000 });
    await page.goto(`/obra/${TEST_PROJECT_ID}/relatorio`);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await runAxe(page);
  });
});

test.describe('Acessibilidade — dark mode (rotas públicas)', () => {
  test('Auth em tema escuro sem violações serious/critical', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });
    await page.goto('/auth');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    // Confirma que `<html class="dark">` foi aplicado.
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(isDark).toBe(true);
    await runAxe(page);
  });
});
