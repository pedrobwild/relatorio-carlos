import { test, expect } from './fixtures/auth';

/**
 * E2E mobile (390×844) — Cronograma: cálculo de "Dias úteis de execução"
 * deve pular finais de semana e feriados (nacionais + SP).
 *
 * Casos cobrem feriados que caem em dias úteis, deslocando o término:
 * - Tiradentes (terça 21/04/2026)
 * - Sexta-Feira Santa (sexta 03/04/2026)
 * - Confraternização Universal (quinta 01/01/2026)
 * - Natal (sexta 25/12/2026)
 * - Revolução Constitucionalista SP (quinta 09/07/2026)
 * - Carnaval (seg 16/02 + ter 17/02 de 2026)
 *
 * Também valida que o cálculo a partir de uma sexta pula o final de semana.
 */
test.describe('EditarObra mobile — Cálculo de dias úteis com feriados', () => {
  const MOBILE = { width: 390, height: 844 };

  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(MOBILE);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  const cases: Array<{ label: string; start: string; days: string; expectedEnd: string }> = [
    { label: 'Tiradentes (21/04/2026, terça)',                 start: '2026-04-20', days: '5', expectedEnd: '2026-04-27' },
    { label: 'Sexta-Feira Santa (03/04/2026)',                 start: '2026-03-30', days: '5', expectedEnd: '2026-04-06' },
    { label: 'Confraternização Universal (01/01/2026)',        start: '2025-12-29', days: '5', expectedEnd: '2026-01-05' },
    { label: 'Natal (25/12/2026, sexta)',                      start: '2026-12-21', days: '5', expectedEnd: '2026-12-28' },
    { label: 'Revolução Constitucionalista SP (09/07/2026)',   start: '2026-07-06', days: '5', expectedEnd: '2026-07-13' },
    { label: 'Carnaval 2026 (seg 16/02 + ter 17/02)',          start: '2026-02-16', days: '5', expectedEnd: '2026-02-25' },
    { label: 'Início numa sexta — pula o fim de semana',       start: '2026-05-01' /* sexta+feriado*/, days: '1', expectedEnd: '2026-05-04' },
  ];

  for (const c of cases) {
    test(`mobile: ${c.days} dia(s) útil(eis) de ${c.start} → ${c.expectedEnd} [${c.label}]`, async ({ staffPage }) => {
      const startInput = staffPage.locator('input[type="date"]').first();
      await startInput.scrollIntoViewIfNeeded();
      await startInput.fill(c.start);
      await startInput.evaluate((el) => (el as HTMLInputElement).blur());

      const duracao = staffPage.locator('#business_days_duration');
      await duracao.scrollIntoViewIfNeeded();
      await expect(duracao).toBeEnabled();
      await duracao.fill(c.days);

      const aplicar = staffPage.getByRole('button', { name: /Aplicar duração/i });
      await expect(aplicar).toBeEnabled();
      // Garante área de toque adequada para mobile
      const box = await aplicar.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
      await aplicar.tap();

      const endInput = staffPage.locator('input[type="date"]').nth(1);
      await expect(endInput).toHaveValue(c.expectedEnd, { timeout: 5000 });

      // Sem overflow horizontal acidental
      const docOverflow = await staffPage.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(docOverflow).toBeLessThanOrEqual(1);
    });
  }
});
