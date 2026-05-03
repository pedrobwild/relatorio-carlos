import { test, expect } from './fixtures/auth';

/**
 * E2E mobile — Edição de obra: cronograma com dias úteis e recálculo semanal.
 *
 * Garante que no mobile (<768px):
 * - O campo "Dias úteis de execução" aparece e aceita entrada numérica.
 * - Aplicar a duração calcula automaticamente o "Término Previsto"
 *   (input desabilitado, valor preenchido).
 * - O botão "Recalcular semana a semana" fica visível, clicável e não
 *   quebra o layout (sem scroll horizontal acidental).
 * - O scroll vertical da página continua funcionando após interagir
 *   com os controles do cronograma.
 */
test.describe('EditarObra — Cronograma mobile (dias úteis + semana a semana)', () => {
  const MOBILE = { width: 390, height: 844 };

  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(MOBILE);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    // Aguarda a aba Geral carregar o card "Cronograma"
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('campo de dias úteis aparece e calcula término automaticamente', async ({ staffPage }) => {
    // 1. Garante uma data de Início Previsto (qualquer segunda-feira válida)
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.scrollIntoViewIfNeeded();
    await startInput.fill('2026-05-04'); // segunda-feira

    // 2. Localiza o campo "Dias úteis de execução"
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await expect(duracao).toBeEnabled();

    // 3. Preenche e aplica
    await duracao.fill('20');
    const aplicar = staffPage.getByRole('button', { name: /Aplicar duração/i });
    await expect(aplicar).toBeEnabled();
    await aplicar.click();

    // 4. Confirma que o término foi calculado (input não vazio)
    // O segundo input[type=date] da seção Cronograma é o Término Previsto.
    const endInput = staffPage.locator('input[type="date"]').nth(1);
    await expect(endInput).not.toHaveValue('');
    const endValue = await endInput.inputValue();
    expect(endValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Para 20 dias úteis a partir de 04/05/2026 (sem feriados nessa janela),
    // o término esperado é 29/05/2026 (sexta).
    expect(endValue).toBe('2026-05-29');
  });

  test('botão "Recalcular semana a semana" é acessível e não quebra layout', async ({ staffPage }) => {
    const recalcBtn = staffPage.getByRole('button', { name: /Recalcular semana a semana/i });

    // Pode não aparecer se a obra não tiver atividades — nesse caso, o teste
    // ainda valida que a ausência não quebra a página.
    const visible = await recalcBtn.isVisible().catch(() => false);

    if (visible) {
      await recalcBtn.scrollIntoViewIfNeeded();
      // Garante área de toque adequada (>= 40px)
      const box = await recalcBtn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

      // Clica e aguarda feedback (toast de sucesso, "já alinhado" ou erro de validação).
      await recalcBtn.click();
      await staffPage.waitForTimeout(500);
    }

    // Sem overflow horizontal acidental no documento
    const docOverflow = await staffPage.evaluate(() => {
      const html = document.documentElement;
      return html.scrollWidth - html.clientWidth;
    });
    expect(docOverflow).toBeLessThanOrEqual(1);
  });

  test('scroll vertical continua funcional após editar duração', async ({ staffPage }) => {
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-05-04');

    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await duracao.fill('15');
    await staffPage.getByRole('button', { name: /Aplicar duração/i }).click();

    // Faz scroll para baixo e confirma que a posição mudou
    const before = await staffPage.evaluate(() => window.scrollY);
    await staffPage.evaluate(() => window.scrollBy(0, 600));
    await staffPage.waitForTimeout(150);
    const after = await staffPage.evaluate(() => window.scrollY);
    expect(after).toBeGreaterThan(before);
  });
});
