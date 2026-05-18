import { test, expect, loginAs } from './fixtures/auth';

/**
 * Multi-aba: duas abas em obras diferentes. O botão "Obras" do bottom nav
 * deve sempre levar para a obra da PRÓPRIA aba (URL prevalece sobre a
 * memória compartilhada em localStorage).
 *
 * Requer dois projetos de teste:
 *   TEST_PROJECT_ID            — obra A
 *   TEST_PROJECT_ID_SECONDARY  — obra B (distinta de A)
 */
const TEST_STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'staff.test@bwild.com.br';
const TEST_STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || 'test123456';
const PROJECT_A = process.env.TEST_PROJECT_ID || '';
const PROJECT_B = process.env.TEST_PROJECT_ID_SECONDARY || '';

const MOBILE = { width: 390, height: 844 };

test.describe('Mobile bottom nav — multi-aba (URL > memória)', () => {
  test('cada aba volta para SUA obra ao clicar em "Obras"', async ({ browser }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(
        true,
        'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY (obras distintas).',
      );
      return;
    }

    // Duas abas independentes (contextos separados = sem compartilhar
    // localStorage, simulando cenário mais hostil que o usuário típico).
    const ctxA = await browser.newContext({ viewport: MOBILE });
    const ctxB = await browser.newContext({ viewport: MOBILE });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await loginAs(tabB, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);

      // 1) Aba A entra em /obra/A, aba B entra em /obra/B (em paralelo).
      await Promise.all([
        tabA.goto(`/obra/${PROJECT_A}`),
        tabB.goto(`/obra/${PROJECT_B}`),
      ]);

      const navA = tabA.getByRole('navigation', { name: /navegação principal/i });
      const navB = tabB.getByRole('navigation', { name: /navegação principal/i });
      await expect(navA).toBeVisible({ timeout: 15000 });
      await expect(navB).toBeVisible({ timeout: 15000 });

      // Cada aba persistiu SUA obra na memória local do seu contexto.
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

      // 2) Em cada aba: navega para uma rota global e volta clicando em
      //    "Obras". A URL da aba (vazia de projectId no momento do clique)
      //    + memória local devem levar de volta para a obra correta —
      //    nunca cruzar entre abas.
      await navA.getByRole('link', { name: /^Início/i }).click();
      await expect(tabA).toHaveURL(/\/gestao\/painel-obras/);
      await navB.getByRole('link', { name: /^Início/i }).click();
      await expect(tabB).toHaveURL(/\/gestao\/painel-obras/);

      await navA.getByRole('link', { name: /^Obras/i }).click();
      await navB.getByRole('link', { name: /^Obras/i }).click();

      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`), {
        timeout: 10000,
      });

      // 3) Sanity final: nenhuma aba "vazou" para a obra da outra.
      expect(tabA.url()).not.toContain(PROJECT_B);
      expect(tabB.url()).not.toContain(PROJECT_A);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('estando dentro de /obra/A, clicar em "Obras" mantém A (URL prevalece)', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(true, 'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY.');
      return;
    }

    // Mesmo contexto (localStorage compartilhado entre as duas abas) para
    // verificar que mesmo com a memória apontando para B, a aba que está
    // em /obra/A não navega para B ao tocar em "Obras".
    const ctx = await browser.newContext({ viewport: MOBILE });
    try {
      const tabA = await ctx.newPage();
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await tabA.goto(`/obra/${PROJECT_A}`);

      // Abre aba B no mesmo contexto e visita /obra/B — sobrescreve a
      // memória compartilhada com PROJECT_B.
      const tabB = await ctx.newPage();
      await tabB.goto(`/obra/${PROJECT_B}`);
      await expect
        .poll(async () =>
          tabB.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        )
        .toBe(PROJECT_B);

      // Volta para a aba A (ainda em /obra/A). Toca em "Obras" — deve
      // permanecer em A porque a URL atual ganha da memória global.
      await tabA.bringToFront();
      const navA = tabA.getByRole('navigation', { name: /navegação principal/i });
      await expect(navA).toBeVisible({ timeout: 15000 });
      await navA.getByRole('link', { name: /^Obras/i }).click();

      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });
      expect(tabA.url()).not.toContain(PROJECT_B);
    } finally {
      await ctx.close();
    }
  });
});
