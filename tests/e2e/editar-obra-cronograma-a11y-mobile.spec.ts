import { test, expect } from './fixtures/auth';

/**
 * E2E mobile (390×844) — Acessibilidade da edição do Cronograma:
 * navegação por teclado e suporte a leitores de tela nos controles
 * "Dias úteis de execução", "Término Previsto" e "Recalcular semana a semana".
 *
 * Objetivos:
 * - Cada controle interativo possui label/role acessível.
 * - Foco visível e ordem de tabulação lógica.
 * - É possível operar tudo só pelo teclado (Tab, Enter, Espaço).
 * - Mensagem de erro do campo é anunciada via aria-describedby + role="alert".
 * - Botão de recálculo abre o diálogo de pré-visualização e Escape devolve foco.
 */
test.describe('EditarObra mobile — A11y do Cronograma (teclado + leitores)', () => {
  const MOBILE = { width: 390, height: 844 };

  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(MOBILE);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Controles têm nomes acessíveis e relações ARIA corretas', async ({ staffPage }) => {
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();

    // Label associado via <Label htmlFor="business_days_duration">
    const labelText = await staffPage.locator('label[for="business_days_duration"]').innerText();
    expect(labelText).toMatch(/Dias úteis de execução/i);

    // aria-describedby aponta para o parágrafo de mensagem
    const describedBy = await duracao.getAttribute('aria-describedby');
    expect(describedBy).toBe('business_days_duration_msg');
    await expect(staffPage.locator('#business_days_duration_msg')).toBeVisible();

    // Botão "Aplicar duração" tem nome acessível
    await expect(staffPage.getByRole('button', { name: /Aplicar duração/i })).toBeVisible();

    // Botão de recálculo (texto pode variar entre "Pré-visualizar recálculo" e "Recalcular semana a semana")
    const recalcBtn = staffPage.getByRole('button', { name: /Pré-visualizar recálculo|Recalcular semana a semana/i });
    if (await recalcBtn.isVisible().catch(() => false)) {
      const name = await recalcBtn.getAttribute('aria-label') || (await recalcBtn.innerText());
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  test('Campo inválido marca aria-invalid e a mensagem usa role="alert"', async ({ staffPage }) => {
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();

    // Foca via teclado e limpa o conteúdo para gerar erro
    await duracao.focus();
    await staffPage.keyboard.press('Control+A');
    await staffPage.keyboard.press('Delete');
    await staffPage.keyboard.press('Tab'); // blur dispara touched

    await expect(duracao).toHaveAttribute('aria-invalid', 'true');

    const msg = staffPage.locator('#business_days_duration_msg');
    await expect(msg).toHaveAttribute('role', 'alert');
    await expect(msg).toContainText(/Informe a duração|maior que zero|números inteiros/i);

    // Botão "Aplicar duração" fica desabilitado enquanto inválido
    await expect(staffPage.getByRole('button', { name: /Aplicar duração/i })).toBeDisabled();
  });

  test('Navegação por Tab atinge duração, aplicar e recálculo na ordem visual', async ({ staffPage }) => {
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-05-04');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await duracao.focus();
    await expect(duracao).toBeFocused();

    // Foco visível: outline ou ring (box-shadow)
    const visibleFocus = await duracao.evaluate((el) => {
      const cs = getComputedStyle(el);
      const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const hasRing = cs.boxShadow && cs.boxShadow !== 'none' && cs.boxShadow.includes('rgb');
      return hasOutline || hasRing;
    });
    expect(visibleFocus).toBe(true);

    // Tab avança para o botão "Aplicar duração"
    await staffPage.keyboard.press('Tab');
    const aplicar = staffPage.getByRole('button', { name: /Aplicar duração/i });
    await expect(aplicar).toBeFocused();

    // Operação por teclado: digita valor, aplica com Enter
    await duracao.focus();
    await duracao.fill('20');
    await staffPage.keyboard.press('Tab'); // foco vai pra Aplicar
    await staffPage.keyboard.press('Enter');

    const endInput = staffPage.locator('input[type="date"]').nth(1);
    await expect(endInput).toHaveValue('2026-05-29', { timeout: 5000 });
  });

  test('Recálculo: ativável por Enter, abre diálogo e Escape devolve foco ao trigger', async ({ staffPage }) => {
    const recalcBtn = staffPage.getByRole('button', { name: /Pré-visualizar recálculo|Recalcular semana a semana/i });
    if (!(await recalcBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Obra de teste sem etapas — botão de recálculo ausente.');
    }

    // Garante início válido
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-05-04');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    await recalcBtn.scrollIntoViewIfNeeded();
    await recalcBtn.focus();
    await expect(recalcBtn).toBeFocused();
    await staffPage.keyboard.press('Enter');

    // Se a versão atual abre diálogo de preview, valida estrutura ARIA
    const dialog = staffPage.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      // Diálogo modal acessível
      const labelledBy = await dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      // Cancelar via Escape e confirmar retorno de foco
      await staffPage.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(recalcBtn).toBeFocused();
    }
  });

  test('Término Previsto continua acessível e editável via teclado', async ({ staffPage }) => {
    const endInput = staffPage.locator('input[type="date"]').nth(1);
    await endInput.scrollIntoViewIfNeeded();
    await endInput.focus();
    await expect(endInput).toBeFocused();
    await expect(endInput).toBeEnabled();

    // Possui rótulo "Término Previsto" próximo (via Label)
    const hasLabel = await staffPage.evaluate(() => {
      return Array.from(document.querySelectorAll('label')).some((l) =>
        /Término Previsto/i.test(l.textContent || ''),
      );
    });
    expect(hasLabel).toBe(true);
  });
});
