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

  test('refresh em /obra/:id mantém fallback: Início → Obras volta para a obra', async ({
    staffPage,
    testProjectId,
  }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.setViewportSize(MOBILE);

    // 1) Entra na obra (popula a memória via efeito do bottom nav).
    await staffPage.goto(`/obra/${testProjectId}`);
    const nav = staffPage.getByRole('navigation', { name: /navegação principal/i });
    await expect(nav).toBeVisible({ timeout: 15000 });

    // Garante que o efeito gravou a memória antes do refresh.
    await expect
      .poll(
        async () =>
          await staffPage.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        { timeout: 5000 },
      )
      .toBe(testProjectId);

    // 2) F5 — reinicia o app na mesma URL.
    await staffPage.reload();
    await expect(staffPage).toHaveURL(new RegExp(`/obra/${testProjectId}(/|$)`));
    await expect(nav).toBeVisible({ timeout: 15000 });

    // 3) Memória deve continuar disponível logo após o refresh.
    const afterReload = await staffPage.evaluate(() =>
      localStorage.getItem('bwild:lastProjectId'),
    );
    expect(afterReload).toBe(testProjectId);

    // 4) Mesmo fluxo do bug: Início → Obras → volta para /obra/:id.
    await nav.getByRole('link', { name: /^Início/i }).click();
    await expect(staffPage).toHaveURL(/\/gestao\/painel-obras/);

    await nav.getByRole('link', { name: /^Obras/i }).click();
    await expect(staffPage).toHaveURL(
      new RegExp(`/obra/${testProjectId}(/|$)`),
      { timeout: 10000 },
    );
  });

  test('refresh em rota global após visitar obra: Obras ainda restaura a obra', async ({
    staffPage,
    testProjectId,
  }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.setViewportSize(MOBILE);

    // 1) Visita a obra para popular a memória.
    await staffPage.goto(`/obra/${testProjectId}`);
    const nav = staffPage.getByRole('navigation', { name: /navegação principal/i });
    await expect(nav).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () =>
          await staffPage.evaluate(() => localStorage.getItem('bwild:lastProjectId')),
        { timeout: 5000 },
      )
      .toBe(testProjectId);

    // 2) Vai para uma rota global e dá F5 lá — agora projectId da URL
    //    é definitivamente undefined desde o primeiro render.
    await staffPage.goto('/gestao/painel-obras');
    await staffPage.reload();
    await expect(nav).toBeVisible({ timeout: 15000 });

    // 3) Clicar em Obras deve voltar para a obra via memória, não ficar
    //    parado no painel global (que era o sintoma do bug).
    await nav.getByRole('link', { name: /^Obras/i }).click();
    await expect(staffPage).toHaveURL(
      new RegExp(`/obra/${testProjectId}(/|$)`),
      { timeout: 10000 },
    );
  });
});
