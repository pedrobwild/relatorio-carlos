import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures/auth';

/**
 * E2E mobile — Auditoria axe-core ao ALTERNAR orientação dinamicamente.
 *
 * Simula o usuário girando o dispositivo (portrait ↔ landscape) sem
 * recarregar a página e revalida o card "Cronograma" em cada estado,
 * garantindo que o layout não introduz violações ao reflowar.
 */

const DEVICES = [
  { name: 'iPhone SE', portrait: { w: 375, h: 667 }, landscape: { w: 667, h: 375 } },
  { name: 'iPhone 12/13/14', portrait: { w: 390, h: 844 }, landscape: { w: 844, h: 390 } },
  { name: 'iPhone 14 Plus / Pro Max', portrait: { w: 428, h: 926 }, landscape: { w: 926, h: 428 } },
];

const CRITICAL_RULES = [
  'aria-allowed-attr', 'aria-allowed-role', 'aria-hidden-body', 'aria-hidden-focus',
  'aria-input-field-name', 'aria-required-attr', 'aria-required-children', 'aria-required-parent',
  'aria-roles', 'aria-toggle-field-name', 'aria-valid-attr', 'aria-valid-attr-value',
  'button-name', 'duplicate-id-aria', 'form-field-multiple-labels', 'label', 'link-name',
  'nested-interactive', 'role-img-alt', 'select-name',
];

const DISABLED = ['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'];

async function runAxe(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('main')
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

for (const dev of DEVICES) {
  test.describe(`EditarObra mobile — A11y ao alternar orientação (${dev.name})`, () => {
    test(`portrait → landscape → portrait sem violações críticas`, async ({ staffPage, testProjectId }) => {
      if (!testProjectId) test.skip();

      // 1. Inicia em portrait
      await staffPage.setViewportSize({ w: dev.portrait.w, h: dev.portrait.h } as any);
      await staffPage.setViewportSize({ width: dev.portrait.w, height: dev.portrait.h });
      await staffPage.goto(`/obra/${testProjectId}/editar`);
      await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });
      await staffPage.getByText(/^Cronograma$/i).first().scrollIntoViewIfNeeded();

      const r1 = await runAxe(staffPage);
      expect(critical(`${dev.name} portrait inicial`, r1)).toEqual([]);

      // 2. Gira para landscape (sem recarregar)
      await staffPage.setViewportSize({ width: dev.landscape.w, height: dev.landscape.h });
      await staffPage.waitForTimeout(300); // permite reflow
      await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible();
      await staffPage.getByText(/^Cronograma$/i).first().scrollIntoViewIfNeeded();

      const r2 = await runAxe(staffPage);
      expect(critical(`${dev.name} landscape pós-rotação`, r2)).toEqual([]);

      // 3. Volta para portrait
      await staffPage.setViewportSize({ width: dev.portrait.w, height: dev.portrait.h });
      await staffPage.waitForTimeout(300);
      await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible();
      await staffPage.getByText(/^Cronograma$/i).first().scrollIntoViewIfNeeded();

      const r3 = await runAxe(staffPage);
      expect(critical(`${dev.name} portrait pós-retorno`, r3)).toEqual([]);

      // 4. Garante que o input principal continua acessível e operável
      const duracao = staffPage.locator('#business_days_duration');
      await duracao.scrollIntoViewIfNeeded();
      await expect(duracao).toBeVisible();
      await expect(duracao).toBeEnabled();
    });
  });
}
