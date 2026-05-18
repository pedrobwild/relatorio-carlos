import { test, expect } from "./fixtures/auth";

/**
 * Regressão: ao clicar num relatório da lista (Relatórios), o ProjectShell
 * scrolla dentro do seu próprio container `overflow-y-auto`, então o template
 * pode renderizar abaixo da viewport — dando a impressão de "não carregou".
 * O Index.tsx faz scrollIntoView no nó de detalhe quando selectedWeeklyReport
 * muda. Este teste valida que:
 *   1. O cabeçalho do relatório ("Semana N") fica visível na viewport mobile;
 *   2. O conteúdo detalhado (template) é de fato renderizado.
 */

const MOBILE = { width: 390, height: 844 };

test.describe("Weekly Report — abrir no mobile mantém cabeçalho visível", () => {
  test.use({ viewport: MOBILE });

  test("cabeçalho do relatório fica visível e conteúdo carrega", async ({
    staffPage,
    testProjectId,
  }) => {
    if (!testProjectId) {
      test.skip();
      return;
    }

    await staffPage.goto(`/obra/${testProjectId}?tab=relatorios`);

    // Aguarda a lista de relatórios montar
    const history = staffPage.getByRole("heading", {
      name: /Histórico de Relatórios/i,
    });
    await expect(history).toBeVisible({ timeout: 15000 });

    // Pega o primeiro card de relatório que esteja habilitado
    const firstReport = staffPage
      .locator('button:not([disabled])')
      .filter({ hasText: /Sem\s*\d+|Semana\s*\d+|^\s*\d{1,2}\s*$/ })
      .first();

    const hasReport = await firstReport.count();
    if (!hasReport) {
      test.skip(true, "Projeto sem relatórios semanais disponíveis");
      return;
    }

    // Scrolla a lista um pouco para garantir que o clique não acontece já no
    // topo (assim o scrollIntoView precisa de fato ajustar a posição).
    await staffPage.evaluate(() => {
      const scroller = document.querySelector('main, [class*="overflow-y-auto"]');
      if (scroller instanceof HTMLElement) scroller.scrollTop = 200;
      else window.scrollTo(0, 200);
    });

    await firstReport.click();

    // 1) Cabeçalho do relatório aparece e fica visível na viewport
    const reportHeader = staffPage
      .getByText(/^Semana\s+\d+/i)
      .first();
    await expect(reportHeader).toBeVisible({ timeout: 10000 });

    // O scrollIntoView usa behavior: smooth + rAF; dá tempo para concluir
    await staffPage.waitForTimeout(800);

    const inViewport = await reportHeader.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      return (
        r.top >= 0 &&
        r.left >= 0 &&
        r.bottom <= vh + 1 &&
        r.right <= vw + 1 &&
        r.width > 0 &&
        r.height > 0
      );
    });
    expect(inViewport).toBe(true);

    // 2) O conteúdo detalhado do template renderiza. Pode ser o estado vazio
    // (Relatório em preparação) ou um relatório real com seções — em qualquer
    // caso, algo abaixo do header precisa estar no DOM.
    const emptyState = staffPage.getByText(/Relatório em preparação/i);
    const filledMarker = staffPage.getByText(
      /Resumo Executivo|Próximas Atividades|Riscos|Decisões do Cliente|Galeria|Progresso/i,
    );
    await expect(emptyState.or(filledMarker).first()).toBeVisible({
      timeout: 10000,
    });

    // 3) Voltar para a lista funciona (sanity)
    const backBtn = staffPage.getByRole("button", {
      name: /Voltar|Histórico|Lista/i,
    });
    if (await backBtn.first().isVisible().catch(() => false)) {
      await backBtn.first().click();
      await expect(history).toBeVisible({ timeout: 5000 });
    }
  });
});
