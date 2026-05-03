import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures/auth';

/**
 * E2E mobile — Auditoria axe-core em orientação LANDSCAPE para viewports iOS.
 *
 * Garante que o card "Cronograma" mantém acessibilidade quando o usuário
 * gira o dispositivo (landscape) em iPhones comuns. Replica os cenários
 * críticos da suíte portrait (estado inicial + erro de validação).
 */

const VIEWPORTS = [
  { name: 'iPhone SE landscape 667×375', width: 667, height: 375 },
  { name: 'iPhone 12/13/14 landscape 844×390', width: 844, height: 390 },
  { name: 'iPhone 14 Plus / Pro Max landscape 926×428', width: 926, height: 428 },
];

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

const DISABLED = ['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'];

async function runAxe(page: Page, scope = 'main') {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include(scope)
    .disableRules(DISABLED)
    .analyze();
}

function reportCritical(label: string, results: Awaited<ReturnType<typeof runAxe>>) {
  const critical = results.violations.filter((v) => CRITICAL_RULES.includes(v.id));
  if (critical.length > 0) {
    for (const v of critical) {
      console.error(
        `[axe ${label}] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      );
    }
  }
  return critical;
}

for (const vp of VIEWPORTS) {
  test.describe(`EditarObra mobile — A11y axe-core landscape (${vp.name})`, () => {
    test.beforeEach(async ({ staffPage, testProjectId }) => {
      if (!testProjectId) test.skip();
      await staffPage.setViewportSize({ width: vp.width, height: vp.height });
      await staffPage.goto(`/obra/${testProjectId}/editar`);
      await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
    });

    test(`sem violações críticas no estado inicial @ ${vp.width}×${vp.height}`, async ({ staffPage }) => {
      await staffPage.getByText(/^Cronograma$/i).first().scrollIntoViewIfNeeded();
      const results = await runAxe(staffPage);
      const critical = reportCritical(`${vp.width}x${vp.height} initial`, results);
      expect(
        critical,
        `Violações críticas em ${vp.width}×${vp.height}: ${critical.map((c) => c.id).join(', ')}`,
      ).toEqual([]);
    });

    test(`sem violações críticas após erro de validação @ ${vp.width}×${vp.height}`, async ({ staffPage }) => {
      const duracao = staffPage.locator('#business_days_duration');
      await duracao.scrollIntoViewIfNeeded();
      await duracao.focus();
      await staffPage.keyboard.press('Control+A');
      await staffPage.keyboard.press('Delete');
      await staffPage.keyboard.press('Tab');

      await expect(duracao).toHaveAttribute('aria-invalid', 'true');

      const results = await runAxe(staffPage);
      const critical = reportCritical(`${vp.width}x${vp.height} invalid`, results);
      expect(critical).toEqual([]);
    });
  });
}
