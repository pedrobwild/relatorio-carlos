import { test, expect, type Page } from './fixtures/auth';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Simula dessincronização entre `projects.planned_end_date` e
 * `MAX(project_activities.planned_end)` em algumas obras, executa a
 * rotina de backfill incremental (`resync_projects_planned_dates`) e
 * verifica que Painel de Obras e Cronograma voltam a exibir a mesma
 * data, em desktop e mobile.
 *
 * Pré-condições: requer SUPABASE_SERVICE_ROLE_KEY para forçar o estado
 * dessincronizado e disparar a RPC. Sem a chave, o teste é pulado.
 */

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

const VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 720 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getEntregaPainel(page: Page, _projectId: string): Promise<string | null> {
  await page.goto('/gestao/painel-obras');
  await page.waitForLoadState('networkidle');
  const cell = page
    .locator('[data-testid="painel-obras-cell-entrega-oficial"]')
    .first();
  await expect(cell).toBeVisible({ timeout: 15000 });
  return (await cell.getAttribute('data-entrega-oficial')) || null;
}

async function getMaxCronograma(page: Page, projectId: string): Promise<string | null> {
  await page.goto(`/obra/${projectId}/cronograma`);
  await page.waitForLoadState('networkidle');
  const isMobile = await page.evaluate(() => window.innerWidth < 768);
  const sel = isMobile
    ? '[data-testid="cronograma-activity-end-mobile"]'
    : '[data-testid="cronograma-activity-end"]';
  await expect(page.locator(sel).first()).toBeVisible({ timeout: 15000 });
  const all = await page.locator(sel).evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.plannedEnd ?? '').filter(Boolean),
  );
  return all.length === 0 ? null : all.sort().slice(-1)[0];
}

for (const vp of VIEWPORTS) {
  test.describe(`Backfill incremental — ${vp.id}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('dessincronizar → resync → Painel volta a bater com Cronograma', async ({
      staffPage,
      testProjectId,
    }) => {
      if (!testProjectId) {
        test.skip(true, 'TEST_PROJECT_ID não configurado');
        return;
      }
      if (!SERVICE_ROLE || !SUPABASE_URL) {
        test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_URL ausentes');
        return;
      }

      const sb = admin();

      // Snapshot do MAX real do cronograma direto do banco
      const { data: aggBefore, error: aggErr } = await sb
        .from('project_activities')
        .select('planned_start, planned_end')
        .eq('project_id', testProjectId)
        .not('planned_start', 'is', null)
        .not('planned_end', 'is', null);
      expect(aggErr, 'leitura de atividades').toBeNull();
      const validRows = (aggBefore ?? []).filter(
        (r: any) => r.planned_end && r.planned_start && r.planned_end >= r.planned_start,
      );
      if (validRows.length === 0) {
        test.skip(true, 'Cronograma vazio — semeie atividades');
        return;
      }
      const realMax = validRows
        .map((r: any) => r.planned_end as string)
        .sort()
        .slice(-1)[0];
      const realMin = validRows
        .map((r: any) => r.planned_start as string)
        .sort()[0];

      // Salva valores atuais para restaurar em caso de erro
      const { data: projBefore } = await sb
        .from('projects')
        .select('planned_start_date, planned_end_date')
        .eq('id', testProjectId)
        .single();

      // Dessincroniza: subtrai 30 dias do planned_end_date (e 30 do start)
      const desync = (iso: string, deltaDays: number) => {
        const d = new Date(iso + 'T00:00:00');
        d.setDate(d.getDate() + deltaDays);
        return d.toISOString().slice(0, 10);
      };
      const fakeEnd = desync(realMax, -30);
      const fakeStart = desync(realMin, -30);

      try {
        const { error: upErr } = await sb
          .from('projects')
          .update({ planned_start_date: fakeStart, planned_end_date: fakeEnd })
          .eq('id', testProjectId);
        expect(upErr, 'update direto bypass trigger via service-role').toBeNull();

        // Painel deve refletir o estado dessincronizado
        const painelDesync = await getEntregaPainel(staffPage, testProjectId);
        expect(painelDesync, 'painel mostra a data dessincronizada').toBe(fakeEnd);

        // Executa o backfill incremental
        const { data: rpcData, error: rpcErr } = await sb.rpc(
          'resync_projects_planned_dates',
        );
        expect(rpcErr, 'RPC de resync executou').toBeNull();
        expect(
          (rpcData as number | null) ?? 0,
          'pelo menos 1 obra recalculada',
        ).toBeGreaterThanOrEqual(1);

        // Painel e Cronograma voltam a bater com o MAX real
        const painelAfter = await getEntregaPainel(staffPage, testProjectId);
        const cronAfter = await getMaxCronograma(staffPage, testProjectId);
        expect(painelAfter, 'Painel restaurado para MAX real').toBe(realMax);
        expect(cronAfter, 'Cronograma reflete MAX real').toBe(realMax);
        expect(painelAfter).toBe(cronAfter);

        // Auditoria registrou a execução com este project_id
        const { data: runs } = await sb
          .from('project_planned_dates_resync_runs')
          .select('changed_ids, projects_changed, started_at')
          .order('started_at', { ascending: false })
          .limit(1);
        expect(runs?.[0]?.changed_ids).toContain(testProjectId);
      } finally {
        // Garante restauração caso a RPC tenha falhado ou rodada parcial
        if (projBefore?.planned_end_date && projBefore?.planned_start_date) {
          await sb
            .from('projects')
            .update({
              planned_start_date: projBefore.planned_start_date,
              planned_end_date: projBefore.planned_end_date,
            })
            .eq('id', testProjectId);
        }
      }
    });
  });
}
