/**
 * Exportação do cronograma em PDF: revisão da obra, telefone do cliente e
 * registro do PDF em Documentos da obra.
 */
import { supabase } from "@/integrations/supabase/client";
import { executeQuery, type RepositoryResult } from "./base.repository";

export interface ScheduleExportMeta {
  schedule_revision: number;
  schedule_exported_at: string | null;
  schedule_exported_end: string | null;
  unit_name: string | null;
  nome_do_empreendimento: string | null;
  customer_name: string | null;
  customer_phone: string | null;
}

export async function getScheduleExportMeta(
  projectId: string,
): Promise<RepositoryResult<ScheduleExportMeta>> {
  return executeQuery(async () => {
    const { data: p, error } = await supabase
      .from("projects")
      .select(
        "schedule_revision, schedule_exported_at, schedule_exported_end, unit_name",
      )
      .eq("id", projectId)
      .maybeSingle();
    if (error) return { data: null, error };
    const { data: studio } = await supabase
      .from("project_studio_info")
      .select("nome_do_empreendimento")
      .eq("project_id", projectId)
      .maybeSingle();
    const { data: c } = await supabase
      .from("project_customers")
      .select("customer_name, customer_phone")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return {
      data: {
        schedule_revision: p?.schedule_revision ?? 0,
        schedule_exported_at: p?.schedule_exported_at ?? null,
        schedule_exported_end: p?.schedule_exported_end ?? null,
        unit_name: p?.unit_name ?? null,
        nome_do_empreendimento: studio?.nome_do_empreendimento ?? null,
        customer_name: c?.customer_name ?? null,
        customer_phone: c?.customer_phone ?? null,
      },
      error: null,
    };
  });
}

export async function saveScheduleExportState(
  projectId: string,
  input: { revision: number; exportedEnd: string | null },
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from("projects")
      .update({
        schedule_revision: input.revision,
        schedule_exported_at: new Date().toISOString(),
        schedule_exported_end: input.exportedEnd,
      })
      .eq("id", projectId);
    return { data: null, error };
  });
}

export async function registerScheduleDocument(input: {
  projectId: string;
  userId: string;
  name: string;
  storagePath: string;
  storageBucket: string;
  sizeBytes: number;
  description?: string;
}): Promise<RepositoryResult<{ id: string }>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .insert({
        project_id: input.projectId,
        document_type: "cronograma",
        name: input.name,
        storage_path: input.storagePath,
        storage_bucket: input.storageBucket,
        mime_type: "application/pdf",
        size_bytes: input.sizeBytes,
        uploaded_by: input.userId,
        status: "approved",
        description: input.description ?? null,
      })
      .select("id")
      .single();
    return { data, error };
  });
}
