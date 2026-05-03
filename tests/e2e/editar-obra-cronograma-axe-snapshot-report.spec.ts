import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './fixtures/auth';
import fs from 'node:fs';
import path from 'node:path';

/**
 * E2E mobile — Relatório de snapshots de violações axe-core.
 *
 * Para cada combinação (viewport × cenário), executa axe-core no Cronograma
 * e persiste:
 *   - JSON detalhado com TODAS as violações (id, impact, help, helpUrl, nós, html)
 *   - Screenshot full-page do estado auditado
 *   - Resumo Markdown consolidando todos os cenários
 *
 * Saída: test-results/axe-snapshots/<timestamp>/
 *
 * O teste só FALHA em violações de regras críticas, mas o relatório completo
 * fica disponível para depuração mesmo quando o teste passa.
 */

const VIEWPORTS = [
  { id: 'android-360x740', name: 'Android compact', width: 360, height: 740 },
  { id: 'iphone-se-375x667', name: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-14-390x844', name: 'iPhone 12/13/14', width: 390, height: 844 },
  { id: 'android-412x915', name: 'Android large', width: 412, height: 915 },
  { id: 'iphone-pro-max-428x926', name: 'iPhone 14 Plus / Pro Max', width: 428, height: 926 },
];

const SCENARIOS = ['inicial', 'erro-validacao'] as const;
type Scenario = (typeof SCENARIOS)[number];

const CRITICAL_RULES = new Set([
  'aria-allowed-attr', 'aria-allowed-role', 'aria-hidden-body', 'aria-hidden-focus',
  'aria-input-field-name', 'aria-required-attr', 'aria-required-children', 'aria-required-parent',
  'aria-roles', 'aria-toggle-field-name', 'aria-valid-attr', 'aria-valid-attr-value',
  'button-name', 'duplicate-id-aria', 'form-field-multiple-labels', 'label', 'link-name',
  'nested-interactive', 'role-img-alt', 'select-name',
]);

const DISABLED = ['color-contrast', 'region', 'landmark-one-main', 'page-has-heading-one'];

const RUN_ID = process.env.AXE_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.resolve('test-results', 'axe-snapshots', RUN_ID);

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

async function runAxe(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('main')
    .disableRules(DISABLED)
    .analyze();
}

async function setupScenario(page: Page, scenario: Scenario) {
  if (scenario === 'inicial') {
    await page.getByText(/^Cronograma$/i).first().scrollIntoViewIfNeeded();
    return;
  }
  if (scenario === 'erro-validacao') {
    const duracao = page.locator('#business_days_duration');
    await duracao.scrollIntoViewIfNeeded();
    await duracao.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Tab');
    await expect(duracao).toHaveAttribute('aria-invalid', 'true');
  }
}

type Snapshot = {
  viewport: string;
  scenario: Scenario;
  width: number;
  height: number;
  totalViolations: number;
  criticalCount: number;
  critical: Array<{ id: string; impact: string | null; help: string; nodes: number }>;
  jsonPath: string;
  screenshotPath: string;
};

const snapshots: Snapshot[] = [];

test.beforeAll(() => {
  ensureDir(OUT_DIR);
});

for (const vp of VIEWPORTS) {
  for (const scenario of SCENARIOS) {
    test(`snapshot axe @ ${vp.id} — ${scenario}`, async ({ staffPage, testProjectId }) => {
      if (!testProjectId) test.skip();

      await staffPage.setViewportSize({ width: vp.width, height: vp.height });
      await staffPage.goto(`/obra/${testProjectId}/editar`);
      await expect(staffPage.getByText(/Cronograma/i).first()).toBeVisible({ timeout: 15000 });

      await setupScenario(staffPage, scenario);

      const results = await runAxe(staffPage);
      const critical = results.violations.filter((v) => CRITICAL_RULES.has(v.id));

      const baseName = `${vp.id}__${scenario}`;
      const jsonPath = path.join(OUT_DIR, `${baseName}.json`);
      const screenshotPath = path.join(OUT_DIR, `${baseName}.png`);

      // Persiste relatório detalhado (todas as violações, não só críticas)
      const report = {
        meta: {
          viewport: vp,
          scenario,
          timestamp: new Date().toISOString(),
          url: staffPage.url(),
        },
        summary: {
          totalViolations: results.violations.length,
          critical: critical.length,
          incomplete: results.incomplete.length,
          passes: results.passes.length,
        },
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          isCritical: CRITICAL_RULES.has(v.id),
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            html: n.html,
            failureSummary: n.failureSummary,
          })),
        })),
      };
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

      // Screenshot do estado auditado (full page)
      await staffPage.screenshot({ path: screenshotPath, fullPage: true });

      snapshots.push({
        viewport: vp.id,
        scenario,
        width: vp.width,
        height: vp.height,
        totalViolations: results.violations.length,
        criticalCount: critical.length,
        critical: critical.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          help: v.help,
          nodes: v.nodes.length,
        })),
        jsonPath: path.relative(process.cwd(), jsonPath),
        screenshotPath: path.relative(process.cwd(), screenshotPath),
      });

      // Falha apenas em violações críticas, com link para os artefatos
      expect(
        critical,
        `Violações críticas em ${vp.id}/${scenario}.\n` +
          `  Relatório: ${jsonPath}\n  Screenshot: ${screenshotPath}\n` +
          `  IDs: ${critical.map((c) => c.id).join(', ')}`,
      ).toEqual([]);
    });
  }
}

test.afterAll(() => {
  if (snapshots.length === 0) return;

  const lines: string[] = [];
  lines.push(`# Relatório axe-core — Cronograma (mobile)`);
  lines.push('');
  lines.push(`Run: \`${RUN_ID}\``);
  lines.push(`Gerado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`| Viewport | Cenário | Total | Críticas | Relatório | Screenshot |`);
  lines.push(`|---|---|---:|---:|---|---|`);
  for (const s of snapshots) {
    lines.push(
      `| ${s.viewport} (${s.width}×${s.height}) | ${s.scenario} | ${s.totalViolations} | ${s.criticalCount} | [json](${path.basename(s.jsonPath)}) | [png](${path.basename(s.screenshotPath)}) |`,
    );
  }

  const failing = snapshots.filter((s) => s.criticalCount > 0);
  if (failing.length > 0) {
    lines.push('');
    lines.push('## Detalhe das violações críticas');
    for (const s of failing) {
      lines.push('');
      lines.push(`### ${s.viewport} — ${s.scenario}`);
      for (const c of s.critical) {
        lines.push(`- **${c.id}** (${c.impact ?? 'n/a'}) — ${c.help} → ${c.nodes} nó(s)`);
      }
    }
  } else {
    lines.push('');
    lines.push('✅ Nenhuma violação crítica detectada nesta execução.');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), lines.join('\n'), 'utf-8');
  fs.writeFileSync(
    path.join(OUT_DIR, 'summary.json'),
    JSON.stringify({ runId: RUN_ID, snapshots }, null, 2),
    'utf-8',
  );

  // eslint-disable-next-line no-console
  console.log(`\n[axe-snapshot] Relatório consolidado: ${path.join(OUT_DIR, 'REPORT.md')}\n`);
});
