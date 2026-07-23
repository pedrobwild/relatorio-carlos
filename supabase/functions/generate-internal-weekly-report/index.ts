// Onda F — Relatório executivo interno automático (staff-only).
// Consolida avanço físico, custos, RDOs, NCs, punch list e lookahead numa
// única linha em `internal_weekly_reports` (upsert por project_id + week_start).
//
// Corpo:
//   { projectId: string, weekStart?: 'YYYY-MM-DD' }
//   Se `weekStart` não vier, usa a segunda-feira da semana corrente (UTC).
//
// Uso: chamada pela UI staff ("Gerar agora") e pelo agendamento semanal
// (pg_cron/pg_net toda segunda de manhã).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Json = Record<string, unknown>;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekStartUTC(from: Date): Date {
  // Segunda-feira 00:00 UTC da semana de `from`.
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

function addDaysUTC(d: Date, n: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Autorização: aceita chave interna (cron) OU JWT de usuário staff.
    const integrationKey = req.headers.get("x-integration-key");
    const cronKey = Deno.env.get("INTEGRATION_API_KEY");
    let generatedBy: string | null = null;

    if (integrationKey && cronKey && integrationKey === cronKey) {
      // Chamada automática (pg_cron). generated_by = null.
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userRes } = await userClient.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return jsonResponse({ error: "unauthorized" }, 401);
      const { data: staffCheck } = await supabase.rpc("is_staff", { _user_id: uid });
      if (!staffCheck) return jsonResponse({ error: "forbidden" }, 403);
      generatedBy = uid;
    }

    const body = (await req.json().catch(() => ({}))) as {
      projectId?: string;
      weekStart?: string;
      allActive?: boolean;
    };

    // Modo em lote: allActive=true gera para todas obras ativas.
    if (body.allActive) {
      const week = body.weekStart ? new Date(body.weekStart + "T00:00:00Z") : weekStartUTC(new Date());
      const { data: activeProjects, error: apErr } = await supabase
        .from("projects")
        .select("id")
        .eq("status", "active")
        .is("deleted_at", null);
      if (apErr) throw apErr;
      const results: Json[] = [];
      for (const p of activeProjects ?? []) {
        try {
          const payload = await buildPayload(supabase, p.id as string, week);
          await upsertReport(supabase, p.id as string, week, payload, generatedBy);
          results.push({ projectId: p.id, ok: true });
        } catch (e) {
          results.push({ projectId: p.id, ok: false, error: (e as Error).message });
        }
      }
      return jsonResponse({ ok: true, count: results.length, results });
    }

    if (!body.projectId) return jsonResponse({ error: "projectId required" }, 400);
    const week = body.weekStart ? new Date(body.weekStart + "T00:00:00Z") : weekStartUTC(new Date());
    const payload = await buildPayload(supabase, body.projectId, week);
    const row = await upsertReport(supabase, body.projectId, week, payload, generatedBy);
    return jsonResponse({ ok: true, report: row });
  } catch (err) {
    console.error("generate-internal-weekly-report error", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

async function upsertReport(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  week: Date,
  payload: Json,
  generatedBy: string | null,
) {
  const weekStart = isoDate(week);
  // Idempotência: se já existir linha ativa para (project_id, week_start), atualiza.
  const { data: existing } = await supabase
    .from("internal_weekly_reports")
    .select("id")
    .eq("project_id", projectId)
    .eq("week_start", weekStart)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("internal_weekly_reports")
      .update({ payload, generated_at: new Date().toISOString(), generated_by: generatedBy })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("internal_weekly_reports")
    .insert({ project_id: projectId, week_start: weekStart, payload, generated_by: generatedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function buildPayload(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  week: Date,
): Promise<Json> {
  const weekStart = isoDate(week);
  const weekEndDate = addDaysUTC(week, 6);
  const weekEnd = isoDate(weekEndDate);
  const nextWeekStart = isoDate(addDaysUTC(week, 7));
  const nextWeekEnd = isoDate(addDaysUTC(week, 13));
  const startISO = week.toISOString();
  const endISO = new Date(weekEndDate.getTime() + 24 * 3600 * 1000 - 1).toISOString();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, planned_start_date, planned_end_date, actual_start_date")
    .eq("id", projectId)
    .maybeSingle();

  // ==== Avanço físico ====
  const [{ data: weighted }, { data: sCurve }, { data: weekMeasurements }] = await Promise.all([
    supabase.rpc("get_project_weighted_progress", { p_project_id: projectId }),
    supabase.rpc("get_project_s_curve_weekly", { p_project_id: projectId }),
    supabase
      .from("activity_progress_measurements")
      .select("id, activity_id, measured_on, progress_percent, notes")
      .eq("project_id", projectId)
      .gte("measured_on", weekStart)
      .lte("measured_on", weekEnd),
  ]);

  // Planejado vs realizado até o fim da semana (curva S).
  let plannedToDate: number | null = null;
  let actualToDate: number | null = null;
  if (Array.isArray(sCurve)) {
    const relevant = (sCurve as Array<{ week_start: string; planned_cum: number; actual_cum: number }>)
      .filter((r) => r.week_start <= weekEnd)
      .sort((a, b) => a.week_start.localeCompare(b.week_start));
    if (relevant.length) {
      const last = relevant[relevant.length - 1];
      plannedToDate = Number(last.planned_cum ?? 0);
      actualToDate = Number(last.actual_cum ?? 0);
    }
  }

  // ==== Custos ====
  const [{ data: costSummary }, { data: costTotals }] = await Promise.all([
    supabase.rpc("get_project_cost_summary", { p_project_id: projectId }),
    supabase.rpc("get_project_cost_totals", { p_project_id: projectId }),
  ]);
  const totals = Array.isArray(costTotals) ? costTotals[0] : costTotals;
  const overCategories = Array.isArray(costSummary)
    ? (costSummary as Array<Record<string, unknown>>).filter((c) => {
        const budget = Number(c.budget_amount ?? 0);
        const realized = Number(c.realized_amount ?? 0);
        return budget > 0 && realized > budget;
      })
    : [];

  // ==== RDOs da semana ====
  const { data: dailyLogs } = await supabase
    .from("project_daily_logs")
    .select("id, log_date, weather_morning, weather_afternoon, occurrences, occurrence_severity")
    .eq("project_id", projectId)
    .gte("log_date", weekStart)
    .lte("log_date", weekEnd);

  const { data: workerLogs } = await supabase
    .from("project_daily_log_workers")
    .select("daily_log_id, worker_count")
    .in("daily_log_id", (dailyLogs ?? []).map((d) => d.id as string));

  const totalWorkers = (workerLogs ?? []).reduce((sum, w) => sum + Number(w.worker_count ?? 0), 0);
  const filledDays = (dailyLogs ?? []).length;
  // Dias úteis: seg-sex dentro da janela (aprox).
  let businessDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDaysUTC(week, i).getUTCDay();
    if (d !== 0 && d !== 6) businessDays++;
  }
  const avgWorkers = filledDays ? totalWorkers / filledDays : 0;

  const occByseverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0, none: 0 };
  for (const dl of dailyLogs ?? []) {
    const sev = (dl.occurrence_severity as string | null) ?? (dl.occurrences ? "low" : "none");
    occByseverity[sev] = (occByseverity[sev] ?? 0) + 1;
  }

  // ==== NCs ====
  const { data: ncsOpenedInWeek } = await supabase
    .from("non_conformities")
    .select("id, severity, status")
    .eq("project_id", projectId)
    .gte("created_at", startISO)
    .lte("created_at", endISO);
  const { data: ncsClosedInWeek } = await supabase
    .from("non_conformities")
    .select("id, severity")
    .eq("project_id", projectId)
    .gte("resolved_at", startISO)
    .lte("resolved_at", endISO);
  const { data: ncsCriticalOpen } = await supabase
    .from("non_conformities")
    .select("id, title, severity, status, due_date")
    .eq("project_id", projectId)
    .in("severity", ["high", "critical"])
    .not("status", "eq", "closed");

  // ==== Punch list ====
  const { data: punch } = await supabase
    .from("punch_items")
    .select("id, room, status")
    .eq("project_id", projectId);
  const punchByRoom: Record<string, { total: number; done: number }> = {};
  for (const p of punch ?? []) {
    const room = (p.ambiente as string | null) ?? "Sem ambiente";
    if (!punchByRoom[room]) punchByRoom[room] = { total: 0, done: 0 };
    punchByRoom[room].total += 1;
    if (String(p.status) === "done" || String(p.status) === "closed") punchByRoom[room].done += 1;
  }

  // ==== Lookahead próxima semana ====
  const { data: lookahead } = await supabase
    .from("project_activities")
    .select("id, description, planned_start, planned_end, responsible_user_id, weight")
    .eq("project_id", projectId)
    .lte("planned_start", nextWeekEnd)
    .gte("planned_end", nextWeekStart)
    .order("planned_start", { ascending: true });
  const lookaheadUnassigned = (lookahead ?? []).filter((a) => !a.responsible_user_id);

  return {
    project: project ?? null,
    week: { start: weekStart, end: weekEnd },
    progress: {
      weighted_percent: weighted ?? null,
      planned_to_date: plannedToDate,
      actual_to_date: actualToDate,
      variance: plannedToDate !== null && actualToDate !== null ? Number(actualToDate) - Number(plannedToDate) : null,
      week_measurements: weekMeasurements ?? [],
    },
    costs: {
      totals: totals ?? null,
      over_categories: overCategories,
    },
    daily_logs: {
      filled_days: filledDays,
      business_days: businessDays,
      coverage_percent: businessDays ? Math.round((filledDays / businessDays) * 100) : 0,
      avg_workers: Math.round(avgWorkers * 10) / 10,
      occurrences_by_severity: occByseverity,
    },
    ncs: {
      opened: (ncsOpenedInWeek ?? []).length,
      closed: (ncsClosedInWeek ?? []).length,
      critical_open: ncsCriticalOpen ?? [],
    },
    punch_list: {
      by_room: punchByRoom,
      total: (punch ?? []).length,
      done: (punch ?? []).filter((p) => String(p.status) === "done" || String(p.status) === "closed").length,
    },
    lookahead: {
      window: { start: nextWeekStart, end: nextWeekEnd },
      activities: lookahead ?? [],
      without_assignee: lookaheadUnassigned,
    },
  };
}
