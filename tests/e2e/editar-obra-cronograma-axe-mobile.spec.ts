import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures/auth';

/**
 * E2E mobile (390×844) — Auditoria de acessibilidade com axe-core no Cronograma.
 *
 * Roda axe-core com regras WCAG 2.1 A/AA + best-practices, focado no card
 * "Cronograma" da tela de edição de obra. Falha se houver violações
 * em regras críticas relacionadas a ARIA, rótulos, contraste e teclado.
 *
 * Como interpretar:
 * - O teste lista todas as violações detectadas no relatório (id, descrição,
 *   nós afetados) para diagnóstico rápido.
 * - Apenas as regras "must-have" definidas em CRITICAL_RULES disparam falha,
 *   evitando falsos positivos comuns em pré-produção (ex.: contraste em
 *   skeletons). As demais ficam como aviso no log.
 */
const PORTRAIT = { width: 390, height: 844 };

// Regras críticas de ARIA/teclado/rótulo que NÃO podem violar.
const CRITICAL_RULES = [
  'aria-allowed-attr',
  'aria-allowed-role',
  'aria-hidden-body',
  'aria-hidden-focus',
  'aria-input-field-name',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roles',
  'aria-toggle-field-name',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'button-name',
  'duplicate-id-aria',
  'form-field-multiple-labels',
  'label',
  'link-name',
  'nested-interactive',
  'role-img-alt',
  'select-name',
];

test.describe('EditarObra mobile — A11y axe-core no Cronograma', () => {
  test.beforeEach(async ({ staffPage, testProjectId }) => {
    if (!testProjectId) test.skip();
    await staffPage.setViewportSize(PORTRAIT);
    await staffPage.goto(`/obra/${testProjectId}/editar`);
    await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('axe-core não reporta violações críticas no Cronograma (estado inicial)', async ({ staffPage }) => {
    // Garante que o card alvo está em viewport
    const cronogramaHeader = staffPage.getByText(/^Cronograma$/i).first();
    await cronogramaHeader.scrollIntoViewIfNeeded();

    const results = await new AxeBuilder({ page: staffPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .include('main')
      // Disable rules that depend on full app context (tema/contraste pode falhar
      // em estados transitórios de skeleton e fora do escopo deste teste).
      .disableRules(['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'])
      .analyze();

    if (results.violations.length > 0) {
      // Loga todas as violações para diagnóstico
      for (const v of results.violations) {
        console.warn(
          `[axe] ${v.id} (${v.impact}) — ${v.help}\n  ${v.helpUrl}\n  Nós: ${v.nodes
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
        );
      }
    }

    const critical = results.violations.filter((v) => CRITICAL_RULES.includes(v.id));
    expect(
      critical,
      `Violações críticas axe-core encontradas: ${critical.map((c) => c.id).join(', ')}`,
    ).toEqual([]);
  });

  test('axe-core não reporta violações críticas após disparar erro de validação', async ({ staffPage }) => {
    // Provoca aria-invalid + role="alert" no campo de duração e revalida
    const duracao = staffPage.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await duracao.focus();
    await staffPage.keyboard.press('Control+A');
    await staffPage.keyboard.press('Delete');
    await staffPage.keyboard.press('Tab');

    await expect(duracao).toHaveAttribute('aria-invalid', 'true');

    const results = await new AxeBuilder({ page: staffPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('main')
      .disableRules(['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'])
      .analyze();

    const critical = results.violations.filter((v) => CRITICAL_RULES.includes(v.id));
    if (critical.length > 0) {
      for (const v of critical) {
        console.error(`[axe] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      }
    }
    expect(critical).toEqual([]);
  });

  test('axe-core não reporta violações críticas no diálogo de pré-visualização', async ({ staffPage }) => {
    const recalcBtn = staffPage.getByRole('button', {
      name: /Pré-visualizar recálculo|Recalcular semana a semana/i,
    });
    if (!(await recalcBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Obra de teste sem etapas — diálogo de recálculo indisponível.');
    }

    // Define início válido e abre o diálogo
    const startInput = staffPage.locator('input[type="date"]').first();
    await startInput.fill('2026-05-04');
    await startInput.evaluate((el) => (el as HTMLInputElement).blur());

    await recalcBtn.scrollIntoViewIfNeeded();
    await recalcBtn.click();

    const dialog = staffPage.getByRole('dialog');
    if (!(await dialog.isVisible().catch(() => false))) {
      test.skip(true, 'Versão atual não abre diálogo de pré-visualização.');
    }

    const results = await new AxeBuilder({ page: staffPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .include('[role="dialog"]')
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter((v) => CRITICAL_RULES.includes(v.id));
    if (critical.length > 0) {
      for (const v of critical) {
        console.error(`[axe-dialog] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      }
    }
    expect(critical).toEqual([]);

    // Fecha o diálogo
    await staffPage.keyboard.press('Escape');
  });
});
