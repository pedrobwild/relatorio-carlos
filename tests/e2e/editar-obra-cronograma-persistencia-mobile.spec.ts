import { test, expect, Page } from '@playwright/test';
import { test as authTest } from './fixtures/auth';

/**
 * E2E mobile (390×844) — Persistência após recálculo semana a semana + Salvar.
 *
 * Fluxo:
 * 1. Abre /obra/:id/editar em mobile.
 * 2. Captura o término e a duração originais para restaurar ao final.
 * 3. Define um Início Previsto conhecido e clica em "Recalcular semana a semana"
 *    (ou em "Pré-visualizar recálculo" → confirmar).
 * 4. Aguarda o término ser atualizado, salva e recarrega a página.
 * 5. Verifica que o término e o número de dias úteis exibidos depois do reload
 *    batem com o que foi calculado antes do Salvar.
 * 6. Restaura datas originais (se possível) para não poluir o ambiente.
 */
const PORTRAIT = { width: 390, height: 844 };

async function getDates(page: Page) {
  const start = await page.locator('input[type="date"]').first().inputValue();
  const end = await page.locator('input[type="date"]').nth(1).inputValue();
  const duracao = await page.locator('#business_days_duration').inputValue().catch(() => '');
  return { start, end, duracao };
}

async function setStart(page: Page, iso: string) {
  const startInput = page.locator('input[type="date"]').first();
  await startInput.scrollIntoViewIfNeeded();
  await startInput.fill(iso);
  await startInput.evaluate((el) => (el as HTMLInputElement).blur());
}

async function triggerWeeklyRecalc(page: Page) {
  const recalcBtn = page.getByRole('button', {
    name: /Pré-visualizar recálculo|Recalcular semana a semana/i,
  });
  if (!(await recalcBtn.isVisible().catch(() => false))) return false;
  await recalcBtn.scrollIntoViewIfNeeded();
  await recalcBtn.click();

  // Caso abra o diálogo de pré-visualização, confirma.
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    const apply = dialog.getByRole('button', { name: /Aplicar a \d+ etapa|Aplicar/i });
    if (await apply.isEnabled().catch(() => false)) {
      await apply.click();
    } else {
      // Nada para aplicar — fecha o diálogo
      await dialog.getByRole('button', { name: /Cancelar/i }).click();
      return false;
    }
  }
  await page.waitForTimeout(800);
  return true;
}

authTest.describe('EditarObra mobile — Persistência após recálculo + salvar', () => {
  authTest.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) authTest.skip();
    await staffPage.setViewportSize(PORTRAIT);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  authTest('término e duração permanecem após recalcular, salvar e recarregar', async ({ staffPage, testProjectId }) => {
    const original = await getDates(staffPage);

    // 1. Define início conhecido e dispara recálculo
    await setStart(staffPage, '2026-05-04'); // segunda-feira
    const recalcDone = await triggerWeeklyRecalc(staffPage);
    if (!recalcDone) {
      authTest.skip(true, 'Obra de teste sem etapas — recálculo indisponível.');
    }

    // 2. Captura término calculado e duração derivada antes de salvar
    const endInput = staffPage.locator('input[type="date"]').nth(1);
    await expect(endInput).not.toHaveValue('');
    const expectedAfterRecalc = await getDates(staffPage);
    expect(expectedAfterRecalc.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(expectedAfterRecalc.end >= '2026-05-04').toBe(true);

    // 3. Salva
    const saveBtn = staffPage.getByRole('button', { name: /^Salvar$/i });
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Trata o diálogo de "como recalcular atividades" caso apareça
    const shiftDialog = staffPage.getByRole('dialog');
    if (await shiftDialog.isVisible().catch(() => false)) {
      const keepBtn = shiftDialog.getByRole('button', {
        name: /Manter duração|Preservar|Salvar mesmo assim|Continuar/i,
      });
      if (await keepBtn.isVisible().catch(() => false)) {
        await keepBtn.click();
      }
    }

    // Aguarda toast/persistência
    await staffPage.waitForTimeout(1200);

    // 4. Recarrega a página e revalida valores
    await staffPage.reload();
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });

    const reloaded = await getDates(staffPage);
    expect(reloaded.start).toBe(expectedAfterRecalc.start);
    expect(reloaded.end).toBe(expectedAfterRecalc.end);

    // 5. Duração derivada (dias úteis) bate
    if (expectedAfterRecalc.duracao) {
      expect(reloaded.duracao).toBe(expectedAfterRecalc.duracao);
    }

    // 6. Restaura datas originais (best-effort)
    if (original.start && original.end) {
      await setStart(staffPage, original.start);
      const endEl = staffPage.locator('input[type="date"]').nth(1);
      await endEl.fill(original.end);
      await endEl.evaluate((el) => (el as HTMLInputElement).blur());
      const save2 = staffPage.getByRole('button', { name: /^Salvar$/i });
      if (await save2.isEnabled().catch(() => false)) {
        await save2.click();
        const dlg = staffPage.getByRole('dialog');
        if (await dlg.isVisible().catch(() => false)) {
          const cancel = dlg.getByRole('button', { name: /Cancelar/i });
          if (await cancel.isVisible().catch(() => false)) await cancel.click();
        }
      }
    }
  });
});
