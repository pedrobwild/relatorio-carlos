import { test, expect } from './fixtures/auth';

/**
 * Regressão: ao entrar em /obra/:id, navegar para Início e voltar tocando
 * em Obras, o usuário deve retornar para a MESMA obra — e não para o
 * painel global. O bug original era que `projectId` (vindo de useParams)
 * sumia ao sair da rota da obra e o ícone "Obras" caía em /gestao/painel-obras.
 *
 * A correção introduziu memória do último projectId (localStorage)
 * consumida por `MobileBottomNav` e pelos slots em `mobileNav.ts`.
 */
test.describe('Mobile bottom nav — fallback de projectId entre tabs', () => {
  const MOBILE = { width: 390, height: 844 };

  test('Obra → Início → Obras volta para a mesma obra', async ({
    staffPage,
    testProjectId,
  }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.setViewportSize(MOBILE);

    // 1) Entra direto na obra
    await staffPage.goto(`/obra/${testProjectId}`);
    await expect(staffPage).toHaveURL(new RegExp(`/obra/${testProjectId}(/|$)`));

    // Garante que o bottom nav (md:hidden) está renderizado em viewport mobile.
    const nav = staffPage.getByRole('navigation', { name: /navegação principal/i });
    await expect(nav).toBeVisible({ timeout: 15000 });

    // 2) Toca em "Início" — sai para a rota global, projectId some da URL.
    await nav.getByRole('link', { name: /^Início/i }).click();
    await expect(staffPage).toHaveURL(/\/gestao\/painel-obras/);

    // 3) Toca em "Obras" — deve voltar para /obra/:id (memória), não para
    //    o painel global novamente.
    await nav.getByRole('link', { name: /^Obras/i }).click();
    await expect(staffPage).toHaveURL(
      new RegExp(`/obra/${testProjectId}(/|$)`),
      { timeout: 10000 },
    );

    // 4) Sanity: lastProjectId persistido reflete a obra atual.
    const lastId = await staffPage.evaluate(() =>
      localStorage.getItem('bwild:lastProjectId'),
    );
    expect(lastId).toBe(testProjectId);
  });

  test('Obra → Atividades → Obras também restaura a obra', async ({
    staffPage,
    testProjectId,
  }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.setViewportSize(MOBILE);
    await staffPage.goto(`/obra/${testProjectId}`);

    const nav = staffPage.getByRole('navigation', { name: /navegação principal/i });
    await expect(nav).toBeVisible({ timeout: 15000 });

    await nav.getByRole('link', { name: /^Atividades/i }).click();
    await expect(staffPage).toHaveURL(/\/gestao\/atividades/);

    await nav.getByRole('link', { name: /^Obras/i }).click();
    await expect(staffPage).toHaveURL(
      new RegExp(`/obra/${testProjectId}(/|$)`),
      { timeout: 10000 },
    );
  });
});
