import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NcSeverity = Database["public"]["Enums"]["nc_severity"];
export type NcStatus = Database["public"]["Enums"]["nc_status"];

type NcRow = Database["public"]["Tables"]["non_conformities"]["Row"];
export type NonConformity = NcRow & {
  responsible_user_name?: string | null;
};
export type NcHistoryEntry = Database["public"]["Tables"]["nc_history"]["Row"];

export async function getNcsByProject(
  projectId: string,
): Promise<NonConformity[]> {
  // Run both queries in parallel to avoid waterfall
  const [ncsResult, profilesResult] = await Promise.all([
    supabase
      .from("non_conformities")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase.from("users_profile").select("id, nome"),
  ]);

  if (ncsResult.error) throw ncsResult.error;

  const nameMap: Record<string, string> = {};
  if (profilesResult.data) {
    profilesResult.data.forEach((p) => {
      nameMap[p.id] = p.nome;
    });
  }

  return (ncsResult.data ?? []).map((nc) => ({
    ...nc,
    responsible_user_name: nc.responsible_user_id
      ? (nameMap[nc.responsible_user_id] ?? null)
      : null,
  })) as NonConformity[];
}

export async function getNcHistory(ncId: string): Promise<NcHistoryEntry[]> {
  const { data, error } = await supabase
    .from("nc_history")
    .select("*")
    .eq("nc_id", ncId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNonConformity(params: {
  project_id: string;
  inspection_id?: string;
  inspection_item_id?: string;
  title: string;
  description?: string;
  severity: NcSeverity;
  responsible_user_id?: string;
  deadline?: string;
  category?: string;
  estimated_cost?: number;
  created_by: string;
}): Promise<NonConformity> {
  const { data, error } = await supabase
    .from("non_conformities")
    .insert({
      project_id: params.project_id,
      inspection_id: params.inspection_id || null,
      inspection_item_id: params.inspection_item_id || null,
      title: params.title,
      description: params.description || null,
      severity: params.severity,
      responsible_user_id: params.responsible_user_id || null,
      deadline: params.deadline || null,
      category: params.category || null,
      estimated_cost: params.estimated_cost ?? null,
      created_by: params.created_by,
    })
    .select()
    .single();

  if (error) throw error;

  // Log history — use await to ensure it completes; catch to avoid blocking the main flow
  try {
    await supabase.from("nc_history").insert({
      nc_id: data.id,
      action: "Não conformidade criada",
      new_status: "open" as NcStatus,
      actor_id: params.created_by,
    });
  } catch (historyError) {
    console.error("[NC History] Failed to log creation:", historyError);
  }

  return data;
}

export async function updateNonConformity(params: {
  id: string;
  title?: string;
  description?: string | null;
  severity?: NcSeverity;
  responsible_user_id?: string | null;
  deadline?: string | null;
  category?: string;
  root_cause?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
}): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) update.title = params.title;
  if (params.description !== undefined) update.description = params.description;
  if (params.severity !== undefined) update.severity = params.severity;
  if (params.responsible_user_id !== undefined)
    update.responsible_user_id = params.responsible_user_id;
  if (params.deadline !== undefined) update.deadline = params.deadline;
  if (params.category !== undefined) update.category = params.category;
  if (params.root_cause !== undefined) update.root_cause = params.root_cause;
  if (params.estimated_cost !== undefined)
    update.estimated_cost = params.estimated_cost;
  if (params.actual_cost !== undefined) update.actual_cost = params.actual_cost;

  const { error } = await supabase
    .from("non_conformities")
    .update(update)
    .eq("id", params.id);
  if (error) throw error;
}

export async function updateNcEvidencePhotos(params: {
  id: string;
  evidence_photos_before?: string[];
  evidence_photos_after?: string[];
}): Promise<void> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.evidence_photos_before !== undefined)
    update.evidence_photos_before = params.evidence_photos_before;
  if (params.evidence_photos_after !== undefined)
    update.evidence_photos_after = params.evidence_photos_after;

  const { error } = await supabase
    .from("non_conformities")
    .update(update)
    .eq("id", params.id);
  if (error) throw error;
}

export async function deleteNonConformity(id: string): Promise<void> {
  // Delete history first (child rows)
  await supabase.from("nc_history").delete().eq("nc_id", id);
  const { error } = await supabase
    .from("non_conformities")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function transitionNcStatus(params: {
  nc_id: string;
  new_status: NcStatus;
  notes?: string;
  corrective_action?: string;
  resolution_notes?: string;
  rejection_reason?: string;
  evidence_photos_before?: string[];
  evidence_photos_after?: string[];
}): Promise<void> {
  const { error } = await supabase.rpc("transition_nc_status", {
    p_nc_id: params.nc_id,
    p_new_status: params.new_status,
    p_notes: params.notes || undefined,
    p_corrective_action: params.corrective_action || undefined,
    p_resolution_notes: params.resolution_notes || undefined,
    p_rejection_reason: params.rejection_reason || undefined,
    p_evidence_photos_before: params.evidence_photos_before || undefined,
    p_evidence_photos_after: params.evidence_photos_after || undefined,
  });
  if (error) throw error;
}
