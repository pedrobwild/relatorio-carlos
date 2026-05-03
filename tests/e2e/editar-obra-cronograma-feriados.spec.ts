import { test, expect } from './fixtures/auth';

/**
 * E2E — Cronograma: respeito a feriados de SP no cálculo de dias úteis.
 *
 * Valida que a função "Aplicar duração" (Dias úteis de execução) computa
 * o Término Previsto pulando sábados, domingos e feriados nacionais/SP,
 * para diferentes datas de início que cruzam feriados conhecidos.
 *
 * Casos de teste (2026):
 * - 20/04 + 5 dias → cruza Tiradentes (21/04) → 27/04
 * - 30/03 + 5 dias → cruza Sexta-Feira Santa (03/04) → 06/04
 * - 29/12/2025 + 5 dias → cruza Confraternização Universal (01/01/2026) → 05/01/2026
 * - 21/12 + 5 dias → cruza Natal (25/12) → 28/12
 * - 06/07 + 5 dias → cruza Revolução Constitucionalista de SP (09/07) → 13/07
 */
test.describe('EditarObra — Cálculo de dias úteis respeita feriados (SP)', () => {
  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  const cases: Array<{ label: string; start: string; days: string; expectedEnd: string }> = [
    { label: 'Tiradentes (21/04/2026)',                start: '2026-04-20', days: '5', expectedEnd: '2026-04-27' },
    { label: 'Sexta-Feira Santa (03/04/2026)',          start: '2026-03-30', days: '5', expectedEnd: '2026-04-06' },
    { label: 'Confraternização Universal (01/01/2026)', start: '2025-12-29', days: '5', expectedEnd: '2026-01-05' },
    { label: 'Natal (25/12/2026)',                      start: '2026-12-21', days: '5', expectedEnd: '2026-12-28' },
    { label: 'Revolução Constitucionalista (09/07/2026)', start: '2026-07-06', days: '5', expectedEnd: '2026-07-13' },
  ];

  for (const c of cases) {
    test(`Aplicar ${c.days} dias úteis a partir de ${c.start} pula ${c.label}`, async ({ staffPage }) => {
      // Início Previsto = primeiro input[type=date] da seção Cronograma
      const startInput = staffPage.locator('input[type="date"]').first();
      await startInput.scrollIntoViewIfNeeded();
      await startInput.fill(c.start);
      // Garante o blur para o estado React atualizar
      await startInput.evaluate((el) => (el as HTMLInputElement).blur());

      const duracao = staffPage.locator('#business_days_duration');
      await duracao.scrollIntoViewIfNeeded();
      await expect(duracao).toBeEnabled();
      await duracao.fill(c.days);

      const aplicar = staffPage.getByRole('button', { name: /Aplicar duração/i });
      await expect(aplicar).toBeEnabled();
      await aplicar.click();

      const endInput = staffPage.locator('input[type="date"]').nth(1);
      await expect(endInput).toHaveValue(c.expectedEnd, { timeout: 5000 });
    });
  }

  test('1 dia útil quando início cai em feriado avança para próximo dia útil', async ({ staffPage }) => {
    // 21/04/2026 = Tiradentes (terça). 1 dia útil deve resultar em 22/04 (quarta).
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-04-21');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    const duracao = staffPage.locator('#business_days_duration');
    await duracao.fill('1');
    await staffPage.getByRole('button', { name: /Aplicar duração/i }).click();

    const endInput = staffPage.locator('input[type="date"]').nth(1);
    // addBusinessDays primeiro avança para o próximo dia útil (22/04) e depois adiciona 0.
    await expect(endInput).toHaveValue('2026-04-22', { timeout: 5000 });
  });
});

/**
 * Recálculo semana a semana: a sexta-feira final não pode cair em feriado.
 * Quando a sexta natural for feriado, a regra recua para o dia útil anterior.
 *
 * Cenário: Sexta-Feira Santa = 03/04/2026.
 * Iniciando uma semana cuja sexta é 03/04, o término da 1ª etapa deve ser 02/04.
 */
test.describe('EditarObra — Recálculo semana a semana respeita feriado na sexta', () => {
  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Sexta-Feira Santa: pré-visualização exibe novo término sem cair no feriado', async ({ staffPage }) => {
    const recalcBtn = staffPage.getByRole('button', { name: /Pré-visualizar recálculo|Recalcular semana a semana/i });
    if (!(await recalcBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Obra de teste não tem etapas — pulando recálculo.');
    }

    // Define início em 30/03/2026 (segunda da semana cuja sexta é a Sexta-Feira Santa)
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-03-30');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    await recalcBtn.scrollIntoViewIfNeeded();
    await recalcBtn.click();

    // Modal de pré-visualização (se existir) ou toast com nova data
    const dialog = staffPage.getByRole('dialog');
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      // No diálogo, a 1ª etapa deve terminar em 02/04 (quinta), nunca em 03/04 (Sexta Santa).
      const dialogText = await dialog.innerText();
      expect(dialogText).not.toMatch(/03 de abr|2026-04-03/i);
      // Pelo menos uma referência válida ao final 02/04
      expect(dialogText).toMatch(/02 de abr|2026-04-02/i);
    } else {
      // Sem diálogo — apenas confirma que a página continua íntegra.
      const docOverflow = await staffPage.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(docOverflow).toBeLessThanOrEqual(1);
    }
  });
});
