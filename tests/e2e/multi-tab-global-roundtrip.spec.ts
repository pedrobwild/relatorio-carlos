import { test, expect, loginAs } from './fixtures/auth';

/**
 * Cenário: duas abas em obras diferentes. Em uma delas, o usuário sai
 * para uma rota global (/gestao/painel-obras) e volta clicando em "Obras"
 * no bottom nav. A aba NÃO pode trocar para a obra da outra aba — deve
 * restaurar a SUA própria obra via memória local.
 *
 * Requer dois projetos distintos:
 *   TEST_PROJECT_ID            — obra A
 *   TEST_PROJECT_ID_SECONDARY  — obra B
 */
const TEST_STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'staff.test@bwild.com.br';
const TEST_STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || 'test123456';
const PROJECT_A = process.env.TEST_PROJECT_ID || '';
const PROJECT_B = process.env.TEST_PROJECT_ID_SECONDARY || '';

const MOBILE = { width: 390, height: 844 };

test.describe('Multi-aba: rota global → "Obras" mantém a obra da aba', () => {
  test('Tab A (/obra/A) → painel global → Obras volta para /obra/A (não para B)', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(
        true,
        'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY (obras distintas).',
      );
      return;
    }

    // Contextos separados = localStorage isolado por aba. Esse é o cenário
    // realista de "duas abas em obras diferentes": cada aba mantém sua
    // própria memória, evitando que a memória global compartilhada confunda
    // o fallback do bottom nav.
    const ctxA = await browser.newContext({ viewport: MOBILE });
    const ctxB = await browser.newContext({ viewport: MOBILE });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await loginAs(tabB, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);

      // 1) Cada aba entra em sua obra.
      await Promise.all([
        tabA.goto(`/obra/${PROJECT_A}`),
        tabB.goto(`/obra/${PROJECT_B}`),
      ]);

      const navA = tabA.getByRole('navigation', { name: /navegação principal/i });
      const navB = tabB.getByRole('navigation', { name: /navegação principal/i });
      await expect(navA).toBeVisible({ timeout: 15000 });
      await expect(navB).toBeVisible({ timeout: 15000 });

      // Sanity: memória local de cada contexto reflete sua própria obra.
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

      // 2) Tab A navega para uma rota global pelo bottom nav (Início).
      await navA.getByRole('link', { name: /^Início/i }).click();
      await expect(tabA).toHaveURL(/\/gestao\/painel-obras/);

      // 3) Enquanto isso, tab B continua na sua obra — não foi afetada.
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`));

      // 4) Tab A toca em "Obras" — deve voltar para /obra/A via memória
      //    local (a sua memória continua sendo PROJECT_A, contexto isolado).
      await navA.getByRole('link', { name: /^Obras/i }).click();
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });

      // 5) Garantias finais: nenhuma aba trocou para a obra da outra.
      expect(tabA.url()).not.toContain(PROJECT_B);
      expect(tabB.url()).not.toContain(PROJECT_A);
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`));
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('simétrico: Tab B faz o mesmo fluxo e volta para /obra/B', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(true, 'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY.');
      return;
    }

    const ctxA = await browser.newContext({ viewport: MOBILE });
    const ctxB = await browser.newContext({ viewport: MOBILE });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await loginAs(tabB, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);

      await Promise.all([
        tabA.goto(`/obra/${PROJECT_A}`),
        tabB.goto(`/obra/${PROJECT_B}`),
      ]);

      const navB = tabB.getByRole('navigation', { name: /navegação principal/i });
      await expect(navB).toBeVisible({ timeout: 15000 });

      // Tab B: Início → Obras deve voltar para /obra/B.
      await navB.getByRole('link', { name: /^Início/i }).click();
      await expect(tabB).toHaveURL(/\/gestao\/painel-obras/);
      await navB.getByRole('link', { name: /^Obras/i }).click();
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`), {
        timeout: 10000,
      });

      // Tab A continua intacta em sua própria obra durante todo o fluxo.
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`));
      expect(tabB.url()).not.toContain(PROJECT_A);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
