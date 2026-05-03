import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures/auth';

/**
 * E2E mobile — Auditoria axe-core em múltiplos viewports adicionais.
 *
 * Garante que o card "Cronograma" mantém consistência de acessibilidade em
 * tamanhos comuns de Android (360×740, 412×915) e iPhone SE (375×667),
 * complementando a suíte base em 390×844.
 *
 * Estratégia: parametriza viewports e roda os mesmos cenários críticos
 * (estado inicial + erro de validação) em cada um deles.
 */

const VIEWPORTS = [
  { name: 'Android compact 360×740', width: 360, height: 740 },
  { name: 'iPhone SE 375×667', width: 375, height: 667 },
  { name: 'Android large 412×915', width: 412, height: 915 },
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
  test.describe(`EditarObra mobile — A11y axe-core (${vp.name})`, () => {
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
