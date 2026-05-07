/**
 * Hook that returns virtual ProjectDocument entries from the latest
 * Projeto 3D and Projeto Executivo versions when the "Liberação da Obra"
 * journey stage is completed.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ProjectDocument } from "./useDocuments";

const BUCKET = "project-documents";

/**
 * Check if the "Liberação da Obra" stage is completed for a project,
 * and if so, return the latest Projeto 3D images and Projeto Executivo PDF
 * as virtual ProjectDocument entries for the Documents page.
 */
export function useJourneyVersionDocuments(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["journey-version-documents", projectId],
    queryFn: async (): Promise<ProjectDocument[]> => {
      if (!projectId) return [];

      // 1. Check if Liberação da Obra stage is completed
      const { data: stages } = await supabase
        .from("journey_stages")
        .select("id, name, status")
        .eq("project_id", projectId);

      if (!stages) return [];

      const mobilizacaoStage = stages.find((s) => {
        const name = s.name.toLowerCase();
        return (
          name.includes("mobilização") ||
          name.includes("mobilizacao") ||
          name.includes("liberação") ||
          name.includes("liberacao")
        );
      });

      if (!mobilizacaoStage || mobilizacaoStage.status !== "completed") {
        return [];
      }

      // 2. Fetch latest versions for both stage_keys
      const { data: versions } = await supabase
        .from("project_3d_versions")
        .select("id, stage_key, version_number, created_at, created_by")
        .eq("project_id", projectId)
        .in("stage_key", ["projeto_3d", "projeto_executivo"])
        .order("version_number", { ascending: false });

      if (!versions || versions.length === 0) return [];

      // Get latest version per stage_key
      const latestByKey = new Map<string, (typeof versions)[0]>();
      for (const v of versions) {
        if (!latestByKey.has(v.stage_key)) {
          latestByKey.set(v.stage_key, v);
        }
      }

      const versionIds = Array.from(latestByKey.values()).map((v) => v.id);
      if (versionIds.length === 0) return [];

      // 3. Fetch files for those versions
      const { data: files } = await supabase
        .from("project_3d_images")
        .select("id, version_id, storage_path, sort_order")
        .in("version_id", versionIds)
        .order("sort_order");

      if (!files || files.length === 0) return [];

      // 4. Generate signed URLs
      const virtualDocs: ProjectDocument[] = [];

      for (const [stageKey, version] of latestByKey.entries()) {
        const versionFiles = files.filter((f) => f.version_id === version.id);
        if (versionFiles.length === 0) continue;

        const category = stageKey === "projeto_3d" ? "projeto_3d" : "executivo";
        const label =
          stageKey === "projeto_3d" ? "Projeto 3D" : "Projeto Executivo";
        const isPdf = stageKey === "projeto_executivo";

        for (const file of versionFiles) {
          const { data: urlData } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(file.storage_path, 3600);

          const fileName = isPdf
            ? `${label} - Versão ${version.version_number}.pdf`
            : `${label} - Versão ${version.version_number} (${file.sort_order + 1}).png`;

          virtualDocs.push({
            id: `journey-${file.id}`,
            project_id: projectId,
            document_type: category,
            name: fileName,
            description: `Versão final aprovada na Jornada do Projeto`,
            storage_path: file.storage_path,
            storage_bucket: BUCKET,
            mime_type: isPdf ? "application/pdf" : "image/png",
            size_bytes: null,
            version: version.version_number,
            status: "approved",
            uploaded_by: version.created_by,
            approved_at: version.created_at,
            approved_by: null,
            parent_document_id: null,
            checksum: null,
            created_at: version.created_at,
            url: urlData?.signedUrl ?? undefined,
          });
        }
      }

      return virtualDocs;
    },
    enabled: !!projectId && !!user,
    staleTime: 5 * 60 * 1000,
  });
}
