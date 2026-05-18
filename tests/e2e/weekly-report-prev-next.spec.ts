import { test, expect } from "./fixtures/auth";

/**
 * Regressão: ao navegar entre semanas usando os botões "Semana anterior" /
 * "Próxima semana" no detalhe do relatório, o cabeçalho deve continuar
 * visível na viewport (o scrollIntoView roda em todo change de
 * selectedWeeklyReport) e o template deve atualizar para a nova semana.
 *
 * Testado em mobile (390x844) e desktop (1366x768).
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };

async function openFirstReport(page: import("@playwright/test").Page, projectId: string) {
  await page.goto(`/obra/${projectId}?tab=relatorios`);

  const history = page.getByRole("heading", { name: /Histórico de Relatórios/i });
  await expect(history).toBeVisible({ timeout: 15000 });

  const firstReport = page
    .locator("button:not([disabled])")
    .filter({ hasText: /Sem\s*\d+|Semana\s*\d+|^\s*\d{1,2}\s*$/ })
    .first();

  const count = await firstReport.count();
  if (!count) return false;

  await firstReport.click();
  await expect(page.getByText(/^Semana\s+\d+/i).first()).toBeVisible({
    timeout: 10000,
  });
  return true;
}

async function readWeekLabel(page: import("@playwright/test").Page) {
  return await page
    .getByText(/^Semana\s+\d+/i)
    .first()
    .textContent();
}

async function expectHeaderInViewport(page: import("@playwright/test").Page) {
  // scrollIntoView usa smooth + rAF
  await page.waitForTimeout(800);

  const header = page.getByText(/^Semana\s+\d+/i).first();
  await expect(header).toBeVisible();

  const inViewport = await header.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top >= 0 && r.bottom <= vh + 1 && r.width > 0 && r.height > 0;
  });
  expect(inViewport).toBe(true);
}

async function expectTemplateRendered(page: import("@playwright/test").Page) {
  const empty = page.getByText(/Relatório em preparação/i);
  const filled = page.getByText(
    /Resumo Executivo|Próximas Atividades|Riscos|Decisões do Cliente|Galeria|Progresso/i,
  );
  await expect(empty.or(filled).first()).toBeVisible({ timeout: 10000 });
}

async function clickNavButton(
  page: import("@playwright/test").Page,
  name: "Semana anterior" | "Próxima semana",
) {
  const btn = page.getByRole("button", { name });
  await expect(btn).toBeVisible();
  if (await btn.isDisabled()) return false;
  await btn.click();
  return true;
}

for (const { label, viewport } of [
  { label: "mobile", viewport: MOBILE },
  { label: "desktop", viewport: DESKTOP },
]) {
  test.describe(`Weekly Report — navegação anterior/próxima (${label})`, () => {
    test.use({ viewport });

    test("anterior/próxima atualizam o template e mantêm cabeçalho visível", async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip();
        return;
      }

      const opened = await openFirstReport(staffPage, testProjectId);
      if (!opened) {
        test.skip(true, "Projeto sem relatórios semanais disponíveis");
        return;
      }

      const initialLabel = (await readWeekLabel(staffPage))?.trim() ?? "";
      await expectHeaderInViewport(staffPage);
      await expectTemplateRendered(staffPage);

      // === Anterior ===
      const wentPrev = await clickNavButton(staffPage, "Semana anterior");
      if (wentPrev) {
        await expect
          .poll(async () => (await readWeekLabel(staffPage))?.trim(), {
            timeout: 10000,
          })
          .not.toBe(initialLabel);

        await expectHeaderInViewport(staffPage);
        await expectTemplateRendered(staffPage);

        // === Próxima (volta para a semana original) ===
        const wentNext = await clickNavButton(staffPage, "Próxima semana");
        expect(wentNext).toBe(true);

        await expect
          .poll(async () => (await readWeekLabel(staffPage))?.trim(), {
            timeout: 10000,
          })
          .toBe(initialLabel);

        await expectHeaderInViewport(staffPage);
        await expectTemplateRendered(staffPage);
      } else {
        // Sem semana anterior: tenta a próxima como fallback
        const wentNext = await clickNavButton(staffPage, "Próxima semana");
        if (!wentNext) {
          test.skip(true, "Relatório único — sem navegação entre semanas");
          return;
        }
        await expect
          .poll(async () => (await readWeekLabel(staffPage))?.trim(), {
            timeout: 10000,
          })
          .not.toBe(initialLabel);

        await expectHeaderInViewport(staffPage);
        await expectTemplateRendered(staffPage);
      }
    });
  });
}
