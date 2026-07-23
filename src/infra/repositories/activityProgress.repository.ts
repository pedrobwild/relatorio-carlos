/**
 * activityProgress.repository — medições de avanço físico por atividade
 * e snapshots de baseline do cronograma (Onda A1, staff-only).
 *
 * Acesso governado por RLS: `is_staff() AND has_project_access(project_id)`.
 * Não usar em superfícies do cliente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ActivityProgressMeasurement {
  id: string;
  activity_id: string;
  project_id: string;
  measured_on: string; // YYYY-MM-DD
  progress_pct: number;
  notes: string | null;
  measured_by: string | null;
  created_at: string;
}

export interface CreateProgressMeasurementInput {
  activity_id: string;
  project_id: string;
  progress_pct: number;
  measured_on?: string;
  notes?: string | null;
}

export interface ScheduleBaseline {
  id: string;
  project_id: string;
  name: string;
  notes: string | null;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ScheduleBaselineActivity {
  id: string;
  baseline_id: string;
  activity_id: string | null;
  description: string;
  planned_start: string;
  planned_end: string;
  weight: number;
  sort_order: number;
  parent_activity_id: string | null;
  etapa: string | null;
}

// ────────────────────────────────────────────────────────────
// Progress measurements
// ────────────────────────────────────────────────────────────

export async function listMeasurementsByActivity(
  activityId: string,
): Promise<ActivityProgressMeasurement[]> {
  const { data, error } = await supabase
    .from("activity_progress_measurements")
    .select("*")
    .eq("activity_id", activityId)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityProgressMeasurement[];
}

export async function listMeasurementsByProject(
  projectId: string,
): Promise<ActivityProgressMeasurement[]> {
  const { data, error } = await supabase
    .from("activity_progress_measurements")
    .select("*")
    .eq("project_id", projectId)
    .order("measured_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityProgressMeasurement[];
}

export async function getLatestMeasurementsForProject(
  projectId: string,
): Promise<Map<string, ActivityProgressMeasurement>> {
  const rows = await listMeasurementsByProject(projectId);
  const latest = new Map<string, ActivityProgressMeasurement>();
  for (const r of rows) {
    if (!latest.has(r.activity_id)) latest.set(r.activity_id, r);
  }
  return latest;
}

export async function createMeasurement(
  input: CreateProgressMeasurementInput,
): Promise<ActivityProgressMeasurement> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;
  const payload = {
    activity_id: input.activity_id,
    project_id: input.project_id,
    progress_pct: input.progress_pct,
    measured_on: input.measured_on ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? null,
    measured_by: uid,
  };
  const { data, error } = await supabase
    .from("activity_progress_measurements")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as ActivityProgressMeasurement;
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase
    .from("activity_progress_measurements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// Schedule baselines
// ────────────────────────────────────────────────────────────

export async function listBaselines(
  projectId: string,
): Promise<ScheduleBaseline[]> {
  const { data, error } = await supabase
    .from("schedule_baselines")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScheduleBaseline[];
}

export async function getCurrentBaseline(
  projectId: string,
): Promise<ScheduleBaseline | null> {
  const { data, error } = await supabase
    .from("schedule_baselines")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ScheduleBaseline | null) ?? null;
}

export async function listBaselineActivities(
  baselineId: string,
): Promise<ScheduleBaselineActivity[]> {
  const { data, error } = await supabase
    .from("schedule_baseline_activities")
    .select("*")
    .eq("baseline_id", baselineId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduleBaselineActivity[];
}

/**
 * Cria uma baseline nomeada a partir das atividades atuais do projeto.
 * Se `makeCurrent`, primeiro desmarca a baseline atual (single-current
 * garantido por unique index parcial).
 */
export async function createBaselineFromCurrentSchedule(input: {
  project_id: string;
  name: string;
  notes?: string | null;
  makeCurrent?: boolean;
}): Promise<ScheduleBaseline> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;

  // 1) Carrega atividades atuais.
  const { data: activities, error: actErr } = await supabase
    .from("project_activities")
    .select(
      "id, description, planned_start, planned_end, weight, sort_order, parent_activity_id, etapa",
    )
    .eq("project_id", input.project_id)
    .order("sort_order", { ascending: true });
  if (actErr) throw actErr;

  // 2) Se makeCurrent, desmarca current existente.
  if (input.makeCurrent) {
    const { error: clearErr } = await supabase
      .from("schedule_baselines")
      .update({ is_current: false })
      .eq("project_id", input.project_id)
      .eq("is_current", true);
    if (clearErr) throw clearErr;
  }

  // 3) Insere baseline.
  const { data: baseline, error: bErr } = await supabase
    .from("schedule_baselines")
    .insert({
      project_id: input.project_id,
      name: input.name,
      notes: input.notes ?? null,
      is_current: input.makeCurrent ?? false,
      created_by: uid,
    })
    .select("*")
    .single();
  if (bErr) throw bErr;

  // 4) Snapshot das atividades.
  if (activities && activities.length > 0) {
    const rows = activities.map((a) => ({
      baseline_id: baseline.id,
      activity_id: a.id,
      description: a.description,
      planned_start: a.planned_start,
      planned_end: a.planned_end,
      weight: a.weight ?? 0,
      sort_order: a.sort_order ?? 0,
      parent_activity_id: a.parent_activity_id ?? null,
      etapa: a.etapa ?? null,
    }));
    const { error: sErr } = await supabase
      .from("schedule_baseline_activities")
      .insert(rows);
    if (sErr) throw sErr;
  }

  return baseline as ScheduleBaseline;
}

export async function setBaselineAsCurrent(
  baselineId: string,
  projectId: string,
): Promise<void> {
  const { error: clearErr } = await supabase
    .from("schedule_baselines")
    .update({ is_current: false })
    .eq("project_id", projectId)
    .eq("is_current", true);
  if (clearErr) throw clearErr;

  const { error } = await supabase
    .from("schedule_baselines")
    .update({ is_current: true })
    .eq("id", baselineId);
  if (error) throw error;
}

export async function deleteBaseline(baselineId: string): Promise<void> {
  const { error } = await supabase
    .from("schedule_baselines")
    .delete()
    .eq("id", baselineId);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────
// S-curve & weighted progress (RPCs — cálculo no banco)
// ────────────────────────────────────────────────────────────

export interface SCurveWeekPoint {
  week_start: string; // YYYY-MM-DD
  planned_pct: number;
  actual_pct: number;
}

export async function getSCurveWeekly(
  projectId: string,
  baselineId?: string | null,
): Promise<SCurveWeekPoint[]> {
  const { data, error } = await supabase.rpc("get_project_s_curve_weekly", {
    p_project_id: projectId,
    p_baseline_id: baselineId ?? undefined,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{
    week_start: string;
    planned_pct: number | string;
    actual_pct: number | string;
  }>).map((r) => ({
    week_start: r.week_start,
    planned_pct: Number(r.planned_pct) || 0,
    actual_pct: Number(r.actual_pct) || 0,
  }));
}

export async function getWeightedProgress(
  projectId: string,
  baselineId?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc("get_project_weighted_progress", {
    p_project_id: projectId,
    p_baseline_id: baselineId ?? undefined,
  });
  if (error) throw error;
  return Number(data ?? 0) || 0;
}
