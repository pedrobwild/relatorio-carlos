import { test, expect, loginAs } from './fixtures/auth';

/**
 * Multi-aba para o CLIENT_NAV (cliente final / customer). O slot "Obra"
 * do bottom nav deve sempre levar para a obra da PRÓPRIA aba, mesmo que
 * a memória compartilhada (localStorage) aponte para outra obra —
 * URL > memória.
 *
 * Requer dois projetos visíveis para o customer de teste:
 *   TEST_PROJECT_ID            — obra A (acessível ao customer)
 *   TEST_PROJECT_ID_SECONDARY  — obra B (acessível ao customer, ≠ A)
 *
 * Credenciais:
 *   TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD
 */
const TEST_CUSTOMER_EMAIL =
  process.env.TEST_CUSTOMER_EMAIL || 'customer.test@bwild.com.br';
const TEST_CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'test123456';
const PROJECT_A = process.env.TEST_PROJECT_ID || '';
const PROJECT_B = process.env.TEST_PROJECT_ID_SECONDARY || '';

const MOBILE = { width: 390, height: 844 };

test.describe('CLIENT_NAV multi-aba — slot "Obra" respeita a URL', () => {
  test('contextos separados: cada aba volta para SUA obra', async ({ browser }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(
        true,
        'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY (obras distintas e acessíveis ao customer).',
      );
      return;
    }

    const ctxA = await browser.newContext({ viewport: MOBILE });
    const ctxB = await browser.newContext({ viewport: MOBILE });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await loginAs(tabA, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);
      await loginAs(tabB, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);

      await Promise.all([
        tabA.goto(`/obra/${PROJECT_A}`),
        tabB.goto(`/obra/${PROJECT_B}`),
      ]);

      const navA = tabA.getByRole('navigation', { name: /navegação principal/i });
      const navB = tabB.getByRole('navigation', { name: /navegação principal/i });
      await expect(navA).toBeVisible({ timeout: 15000 });
      await expect(navB).toBeVisible({ timeout: 15000 });

      // Memória local de cada contexto reflete sua própria obra.
      await expect
        .poll(async () =>
          tabA.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        )
        .toBe(PROJECT_A);
      await expect
        .poll(async () =>
          tabB.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        )
        .toBe(PROJECT_B);

      // Sai para uma sub-rota dentro de cada obra (Financeiro), depois
      // toca em "Obra" — deve voltar para /obra/:id (raiz) da própria aba.
      await navA.getByRole('link', { name: /^Financeiro/i }).click();
      await navB.getByRole('link', { name: /^Financeiro/i }).click();
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}/financeiro`));
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}/financeiro`));

      await navA.getByRole('link', { name: /^Obra($|\s)/i }).click();
      await navB.getByRole('link', { name: /^Obra($|\s)/i }).click();

      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`), {
        timeout: 10000,
      });

      // Garantia explícita: nenhuma aba cruzou para a obra da outra.
      expect(tabA.url()).not.toContain(PROJECT_B);
      expect(tabB.url()).not.toContain(PROJECT_A);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('mesmo contexto: aba em /obra/A ignora memória que aponta para B', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(true, 'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY.');
      return;
    }

    const ctx = await browser.newContext({ viewport: MOBILE });
    try {
      const tabA = await ctx.newPage();
      await loginAs(tabA, TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD);
      await tabA.goto(`/obra/${PROJECT_A}`);

      // Segunda aba (mesmo contexto = localStorage compartilhado) entra
      // em /obra/B e sobrescreve a memória global com PROJECT_B.
      const tabB = await ctx.newPage();
      await tabB.goto(`/obra/${PROJECT_B}`);
      await expect
        .poll(async () =>
          tabB.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        )
        .toBe(PROJECT_B);

      // Volta para a aba A (URL ainda em /obra/A). Tocar em "Obra" deve
      // permanecer em A — a URL da aba ativa prevalece sobre a memória.
      await tabA.bringToFront();
      const navA = tabA.getByRole('navigation', { name: /navegação principal/i });
      await expect(navA).toBeVisible({ timeout: 15000 });

      await navA.getByRole('link', { name: /^Obra($|\s)/i }).click();
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });
      expect(tabA.url()).not.toContain(PROJECT_B);
    } finally {
      await ctx.close();
    }
  });
});
