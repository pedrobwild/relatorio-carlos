/**
 * Journey Repository
 *
 * Centralized data access for journey stages, CSM, and related queries.
 */

import {
  supabase,
  executeQuery,
  executeListQuery,
  type RepositoryResult,
  type RepositoryListResult,
} from "./base.repository";

// ============================================================================
// Types
// ============================================================================

export interface JourneyStage {
  id: string;
  project_id: string;
  name: string;
  status: string;
  sort_order: number;
  description: string | null;
  icon: string | null;
}

export interface JourneyCSM {
  id: string;
  project_id: string;
  name: string;
  role_title: string;
  description: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
}

export interface UpdateCSMInput {
  name: string;
  role_title: string;
  description: string;
  email: string | null;
  phone: string | null;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Get all journey stages for a project, ordered by sort_order
 */
export async function getProjectStages(
  projectId: string,
): Promise<RepositoryListResult<JourneyStage>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase
      .from("journey_stages")
      .select("id, project_id, name, status, sort_order, description, icon")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    return { data: data ?? null, error };
  });
}

/**
 * Get the current (first non-completed) stage name
 */
export async function getCurrentStageName(
  projectId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("journey_stages")
    .select("name, status")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return null;
  const current = data.find((s) => s.status !== "completed");
  return current?.name ?? data[data.length - 1]?.name ?? null;
}

/**
 * Get current obra etapa (from atividades)
 */
export async function getCurrentObraEtapa(
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("atividades")
    .select("titulo, etapa, status, data_prevista_fim")
    .eq("obra_id", projectId)
    .in("status", ["em_andamento", "nao_iniciada"])
    .order("data_prevista_fim", { ascending: true })
    .limit(1);

  if (data && data.length > 0) {
    return data[0].etapa || data[0].titulo;
  }
  return null;
}

/**
 * Get activity progress data for a project
 */
export async function getActivityProgressData(
  projectId: string,
): Promise<Array<{ weight: number; actualEnd: string | null }>> {
  const { data } = await supabase
    .from("project_activities")
    .select("weight, actual_end")
    .eq("project_id", projectId);

  if (!data || data.length === 0) return [];
  return data.map((a) => ({
    weight: Number(a.weight) || 0,
    actualEnd: a.actual_end,
  }));
}

/**
 * Update CSM information
 */
export async function updateCSM(
  csmId: string,
  input: UpdateCSMInput,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from("journey_csm")
      .update({
        name: input.name,
        role_title: input.role_title,
        description: input.description,
        email: input.email,
        phone: input.phone,
      })
      .eq("id", csmId);
    return { data: null, error };
  });
}

/**
 * Update CSM photo URL
 */
export async function updateCSMPhoto(
  csmId: string,
  photoUrl: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from("journey_csm")
      .update({ photo_url: photoUrl })
      .eq("id", csmId);
    return { data: null, error };
  });
}

/**
 * Upload CSM photo to storage
 */
export async function uploadCSMPhoto(
  projectId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `csm-photos/${projectId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("project-documents")
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) {
    console.error("CSM photo upload error:", uploadError);
    return null;
  }

  const { data } = supabase.storage
    .from("project-documents")
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Get image counts per 3D version
 */
export async function get3DImageCounts(
  versionIds: string[],
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("project_3d_images")
    .select("version_id")
    .in("version_id", versionIds);

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.version_id] = (counts[row.version_id] || 0) + 1;
  });
  return counts;
}

/**
 * Request revision on a 3D version
 */
export async function requestRevision(
  versionId: string,
  userId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from("project_3d_versions")
      .update({
        revision_requested_at: new Date().toISOString(),
        revision_requested_by: userId,
      })
      .eq("id", versionId);
    return { data: null, error };
  });
}
