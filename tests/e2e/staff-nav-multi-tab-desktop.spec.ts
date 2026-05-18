import { test, expect, loginAs } from './fixtures/auth';

/**
 * Multi-aba em viewport DESKTOP.
 *
 * Em desktop o bottom nav (md:hidden) não renderiza — a navegação acontece
 * pela GestaoSidebar. O botão "Obras" do sidebar é GLOBAL por design
 * (sempre vai para /gestao/painel-obras), então o contrato "URL > memória"
 * aqui se traduz como:
 *
 *  1) Clicar em "Obras" em qualquer aba leva ao painel global — nunca
 *     atravessa para a obra da outra aba (não há vazamento de projectId
 *     entre abas).
 *  2) `bwild:lastProjectId` em cada aba reflete a obra que aquela aba
 *     visitou — contextos isolados não compartilham memória e contextos
 *     compartilhados preservam consistência via URL ativa.
 *
 * Requer dois projetos distintos: TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY.
 */
const TEST_STAFF_EMAIL = process.env.TEST_STAFF_EMAIL || 'staff.test@bwild.com.br';
const TEST_STAFF_PASSWORD = process.env.TEST_STAFF_PASSWORD || 'test123456';
const PROJECT_A = process.env.TEST_PROJECT_ID || '';
const PROJECT_B = process.env.TEST_PROJECT_ID_SECONDARY || '';

const DESKTOP = { width: 1440, height: 900 };

test.describe('Sidebar staff multi-aba — viewport desktop', () => {
  test('cada aba mantém sua obra ao clicar em "Obras" do sidebar', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(
        true,
        'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY (obras distintas).',
      );
      return;
    }

    const ctxA = await browser.newContext({ viewport: DESKTOP });
    const ctxB = await browser.newContext({ viewport: DESKTOP });
    const tabA = await ctxA.newPage();
    const tabB = await ctxB.newPage();

    try {
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await loginAs(tabB, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);

      await Promise.all([
        tabA.goto(`/obra/${PROJECT_A}`),
        tabB.goto(`/obra/${PROJECT_B}`),
      ]);

      // Sanity: cada aba está na sua obra e gravou sua memória local.
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`));
      await expect(tabB).toHaveURL(new RegExp(`/obra/${PROJECT_B}(/|$)`));
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

      // Bottom nav NÃO deve existir em desktop (md:hidden).
      await expect(
        tabA.getByRole('navigation', { name: /navegação principal/i }),
      ).toHaveCount(0);

      // Clique em "Obras" do sidebar em cada aba.
      const sidebarObrasA = tabA.getByRole('tab', { name: /^Obras$/ });
      const sidebarObrasB = tabB.getByRole('tab', { name: /^Obras$/ });
      await expect(sidebarObrasA).toBeVisible({ timeout: 15000 });
      await expect(sidebarObrasB).toBeVisible({ timeout: 15000 });

      await sidebarObrasA.click();
      await sidebarObrasB.click();

      // Ambas vão para o painel global — comportamento esperado do sidebar
      // desktop (é global, não volta para a obra). O que NÃO pode acontecer
      // é uma aba terminar na obra da outra.
      await expect(tabA).toHaveURL(/\/gestao\/painel-obras/, { timeout: 10000 });
      await expect(tabB).toHaveURL(/\/gestao\/painel-obras/, { timeout: 10000 });
      expect(tabA.url()).not.toContain(PROJECT_B);
      expect(tabB.url()).not.toContain(PROJECT_A);

      // Memória de cada contexto continua apontando para a obra correta —
      // não houve vazamento da memória da outra aba.
      const memA = await tabA.evaluate(() =>
        localStorage.getItem('bwild:lastProjectId'),
      );
      const memB = await tabB.evaluate(() =>
        localStorage.getItem('bwild:lastProjectId'),
      );
      expect(memA).toBe(PROJECT_A);
      expect(memB).toBe(PROJECT_B);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('mesmo contexto: aba em /obra/A ignora memória de B ao usar voltar do navegador', async ({
    browser,
  }) => {
    if (!PROJECT_A || !PROJECT_B || PROJECT_A === PROJECT_B) {
      test.skip(true, 'Defina TEST_PROJECT_ID e TEST_PROJECT_ID_SECONDARY.');
      return;
    }

    const ctx = await browser.newContext({ viewport: DESKTOP });
    try {
      const tabA = await ctx.newPage();
      await loginAs(tabA, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD);
      await tabA.goto(`/obra/${PROJECT_A}`);

      // Segunda aba (mesmo contexto, localStorage compartilhado) entra em
      // /obra/B e reescreve a memória global com PROJECT_B.
      const tabB = await ctx.newPage();
      await tabB.goto(`/obra/${PROJECT_B}`);
      await expect
        .poll(async () =>
          tabB.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        )
        .toBe(PROJECT_B);

      // Volta para a aba A. Sai para o painel via "Obras" do sidebar e
      // depois volta no histórico: deve retornar para /obra/A (a URL da
      // própria aba), não para /obra/B (memória global).
      await tabA.bringToFront();
      const obrasTab = tabA.getByRole('tab', { name: /^Obras$/ });
      await expect(obrasTab).toBeVisible({ timeout: 15000 });
      await obrasTab.click();
      await expect(tabA).toHaveURL(/\/gestao\/painel-obras/, { timeout: 10000 });

      await tabA.goBack();
      await expect(tabA).toHaveURL(new RegExp(`/obra/${PROJECT_A}(/|$)`), {
        timeout: 10000,
      });
      expect(tabA.url()).not.toContain(PROJECT_B);
    } finally {
      await ctx.close();
    }
  });
});
