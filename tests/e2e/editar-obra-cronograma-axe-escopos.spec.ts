import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures/auth';

/**
 * E2E mobile — Auditoria axe-core em ESCOPOS distintos.
 *
 * Garante que não há violações ARIA críticas em diferentes regiões da tela
 * de edição de obra:
 *   1. main           → conteúdo principal completo
 *   2. card Cronograma → seção isolada do cronograma
 *   3. modal/dialog   → diálogo de pré-visualização de recálculo
 *
 * Auditar por escopo ajuda a localizar a origem de violações que ficariam
 * diluídas em uma única auditoria global.
 */

const PORTRAIT = { width: 390, height: 844 };

const CRITICAL_RULES = [
  'aria-allowed-attr', 'aria-allowed-role', 'aria-hidden-body', 'aria-hidden-focus',
  'aria-input-field-name', 'aria-required-attr', 'aria-required-children', 'aria-required-parent',
  'aria-roles', 'aria-toggle-field-name', 'aria-valid-attr', 'aria-valid-attr-value',
  'button-name', 'duplicate-id-aria', 'form-field-multiple-labels', 'label', 'link-name',
  'nested-interactive', 'role-img-alt', 'select-name',
];

const DISABLED = ['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'];

async function runAxe(page: Page, scope: string) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include(scope)
    .disableRules(DISABLED)
    .analyze();
}

function critical(label: string, results: Awaited<ReturnType<typeof runAxe>>) {
  const c = results.violations.filter((v) => CRITICAL_RULES.includes(v.id));
  for (const v of c) {
    console.error(`[axe ${label}] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  }
  return c;
}

test.describe('EditarObra mobile — A11y axe-core por escopo', () => {
  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(PORTRAIT);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('escopo MAIN — sem violações críticas no conteúdo principal', async ({ staffPage }) => {
    const results = await runAxe(staffPage, 'main');
    expect(critical('main', results)).toEqual([]);
  });

  test('escopo CARD Cronograma — sem violações críticas na seção isolada', async ({ staffPage }) => {
    const cardSelector = '#business_days_duration';
    const handle = staffPage.locator(cardSelector);
    await handle.scrollIntoViewIfNeeded();

    // Usa o ancestral mais próximo que represente o card
    const cardScope = await staffPage.evaluate(() => {
      const input = document.getElementById('business_days_duration');
      const card = input?.closest('section, [role="region"], .rounded-lg, [data-card], .card') as HTMLElement | null;
      if (card && !card.id) card.id = 'cronograma-axe-scope';
      return card?.id || null;
    });

    expect(cardScope, 'Card do Cronograma deve ser localizável no DOM').toBeTruthy();

    const results = await runAxe(staffPage, `#${cardScope}`);
    expect(critical('card-cronograma', results)).toEqual([]);
  });

  test('escopo MODAL — sem violações críticas no diálogo de pré-visualização', async ({ staffPage }) => {
    const recalcBtn = staffPage.getByRole('button', {
      name: /Pré-visualizar recálculo|Recalcular semana a semana/i,
    });
    if (!(await recalcBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Obra de teste sem etapas — diálogo indisponível.');
    }

    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-05-04');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    await recalcBtn.scrollIntoViewIfNeeded();
    await recalcBtn.click();

    const dialog = staffPage.getByRole('dialog');
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, 'Versão atual não abre diálogo de pré-visualização.');
    }

    const results = await runAxe(staffPage, '[role="dialog"]');
    expect(critical('dialog', results)).toEqual([]);

    await staffPage.keyboard.press('Escape');
  });
});
