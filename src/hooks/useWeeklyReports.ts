import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPhoto, WeeklyReportData } from "@/types/weeklyReport";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { useReportImageUpload } from "./useReportImageUpload";
import { queryKeys } from "@/lib/queryKeys";
import { reportLogger } from "@/lib/devLogger";

const WEEKLY_REPORTS_BUCKET = "weekly-reports";
// Signed URL TTL is 6h; the query refetches itself every 4h
// (REFETCH_GALLERY_URLS_MS) so users on a long-open tab always get a refresh
// before URLs expire — staleTime alone doesn't trigger timed refetches.
const REFRESH_SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;
const REFETCH_GALLERY_URLS_MS = 1000 * 60 * 60 * 4;

/**
 * Extracts the storage path from a saved gallery URL. Handles three formats
 * that exist in production data:
 *   - public bucket URL:        .../object/public/weekly-reports/<path>
 *   - signed URL:               .../object/sign/weekly-reports/<path>?token=...
 *   - authenticated object URL: .../object/weekly-reports/<path>
 *
 * Returns null for blob/data URLs or anything that doesn't reference the
 * weekly-reports bucket.
 */
function extractWeeklyReportPath(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("blob:") || url.startsWith("data:")) return null;
  const marker = `/${WEEKLY_REPORTS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const tail = url.slice(idx + marker.length);
  const queryIdx = tail.indexOf("?");
  return queryIdx === -1 ? tail : tail.slice(0, queryIdx);
}

/**
 * Resolves the storage path for a gallery photo. Prefers the explicit `path`
 * field (written on upload since the Bug #1 fix); falls back to parsing it out
 * of a saved URL for legacy rows that predate the `path` field. When neither
 * works the photo is unrecoverable — log it (with id) so we can spot legacy
 * data that needs a backfill instead of failing silently.
 */
function resolveWeeklyReportPath(photo: GalleryPhoto): string | null {
  if (photo.path) return photo.path;
  const fromUrl = extractWeeklyReportPath(photo.url);
  if (fromUrl) return fromUrl;
  if (photo.url && !photo.url.startsWith("blob:")) {
    reportLogger.warn("weekly-report photo has no resolvable storage path", {
      photoId: photo.id,
      url: photo.url,
    });
  }
  return null;
}

/**
 * Regenerates signed URLs for every gallery photo across all reports in a
 * single batched request. Saved URLs go stale (7-day signed-URL TTL or legacy
 * public-bucket URLs that no longer resolve since the bucket went private),
 * which is why customers see broken media even though the row reads fine.
 *
 * If signing fails we keep the original URL — staff may still resolve it via
 * cache and we don't want to clobber the report with empty thumbnails.
 */
async function refreshGalleryUrls(
  rows: WeeklyReportRow[],
): Promise<WeeklyReportRow[]> {
  const allPaths = new Set<string>();
  for (const row of rows) {
    const data = row.data as unknown as { gallery?: GalleryPhoto[] } | null;
    const gallery = data?.gallery;
    if (!gallery || gallery.length === 0) continue;
    for (const photo of gallery) {
      const path = resolveWeeklyReportPath(photo);
      if (path) allPaths.add(path);
    }
  }

  if (allPaths.size === 0) return rows;

  const paths = Array.from(allPaths);
  const { data: signed, error } = await supabase.storage
    .from(WEEKLY_REPORTS_BUCKET)
    .createSignedUrls(paths, REFRESH_SIGNED_URL_TTL_SECONDS);

  if (error || !signed) return rows;

  const pathToUrl = new Map<string, string>();
  for (const item of signed) {
    if (item.signedUrl && !item.error && item.path) {
      pathToUrl.set(item.path, item.signedUrl);
    }
  }
  if (pathToUrl.size === 0) return rows;

  return rows.map((row) => {
    const data = row.data as unknown as { gallery?: GalleryPhoto[] } | null;
    const gallery = data?.gallery;
    if (!gallery || gallery.length === 0) return row;
    const refreshed = gallery.map((photo) => {
      const path = resolveWeeklyReportPath(photo);
      const fresh = path ? pathToUrl.get(path) : undefined;
      // Keep `path` persisted so future loads don't depend on URL parsing.
      if (fresh) return { ...photo, path: path ?? photo.path, url: fresh };
      return path && !photo.path ? { ...photo, path } : photo;
    });
    return {
      ...row,
      data: { ...(data ?? {}), gallery: refreshed } as unknown as Json,
    };
  });
}

/**
 * True quando o relatório tem qualquer conteúdo preenchido (texto, listas
 * ou fotos). Usado pelo guarda anti-apagão em saveReport.
 */
function hasReportContent(d: WeeklyReportData | null | undefined): boolean {
  if (!d) return false;
  return (
    (d.executiveSummary?.trim().length ?? 0) > 0 ||
    (d.lookaheadTasks?.length ?? 0) > 0 ||
    (d.risksAndIssues?.length ?? 0) > 0 ||
    (d.clientDecisions?.length ?? 0) > 0 ||
    (d.incidents?.length ?? 0) > 0 ||
    (d.gallery?.length ?? 0) > 0
  );
}

interface WeeklyReportRow {
  id: string;
  project_id: string;
  week_number: number;
  week_start: string;
  week_end: string;
  available_at: string | null;
  data: Json;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

interface UseWeeklyReportsOptions {
  projectId: string | undefined;
}

export function useWeeklyReports({ projectId }: UseWeeklyReportsOptions) {
  const queryClient = useQueryClient();
  const [savingWeek, setSavingWeek] = useState<number | null>(null);
  const { uploadGalleryPhotos, isUploading } = useReportImageUpload();

  // Use centralized query key for consistency
  const queryKey = queryKeys.weeklyReports.list(projectId);

  const {
    data: reports = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("project_id", projectId)
        .order("week_number", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as WeeklyReportRow[];
      return await refreshGalleryUrls(rows);
    },
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: REFETCH_GALLERY_URLS_MS,
    refetchIntervalInBackground: false,
  });

  // Map week_number -> stored WeeklyReportData
  const reportDataByWeek = new Map<number, WeeklyReportData>();
  // Map week_number -> server-controlled availability timestamp (or null).
  // When set, this is the source of truth for whether a customer may view the
  // report — the frontend date heuristic is only a fallback.
  const availableAtByWeek = new Map<number, string | null>();
  for (const row of reports) {
    reportDataByWeek.set(
      row.week_number,
      row.data as unknown as WeeklyReportData,
    );
    availableAtByWeek.set(row.week_number, row.available_at);
  }

  const upsertMutation = useMutation({
    mutationFn: async ({
      weekNumber,
      weekStart,
      weekEnd,
      data,
    }: {
      weekNumber: number;
      weekStart: string;
      weekEnd: string;
      data: WeeklyReportData;
    }) => {
      if (!projectId) throw new Error("Projeto não selecionado");

      const operationId = `save-week-${weekNumber}`;
      reportLogger.start(operationId, `Saving week ${weekNumber}`, {
        projectId,
        weekNumber,
      });

      setSavingWeek(weekNumber);

      const { error } = await supabase.from("weekly_reports").upsert(
        {
          project_id: projectId,
          week_number: weekNumber,
          week_start: weekStart,
          week_end: weekEnd,
          data: data as unknown as Json,
        },
        { onConflict: "project_id,week_number" },
      );

      if (error) {
        reportLogger.error(operationId, error, { weekNumber });
        throw error;
      }

      reportLogger.end(operationId, { level: "success", data: { weekNumber } });
    },
    // Optimistic update: write to cache immediately so the UI doesn't flicker
    // while the upsert is in flight, especially on slow connections.
    onMutate: async ({ weekNumber, weekStart, weekEnd, data }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousReports =
        queryClient.getQueryData<WeeklyReportRow[]>(queryKey);

      const nowIso = new Date().toISOString();
      queryClient.setQueryData<WeeklyReportRow[]>(queryKey, (old = []) => {
        const existingIdx = old.findIndex((r) => r.week_number === weekNumber);
        const optimisticRow: WeeklyReportRow = {
          id:
            existingIdx >= 0 ? old[existingIdx].id : `optimistic-${weekNumber}`,
          project_id: projectId!,
          week_number: weekNumber,
          week_start: weekStart,
          week_end: weekEnd,
          available_at: existingIdx >= 0 ? old[existingIdx].available_at : null,
          data: data as unknown as Json,
          created_by: existingIdx >= 0 ? old[existingIdx].created_by : null,
          created_at: existingIdx >= 0 ? old[existingIdx].created_at : nowIso,
          updated_by: existingIdx >= 0 ? old[existingIdx].updated_by : null,
          updated_at: nowIso,
        };
        if (existingIdx >= 0) {
          const next = [...old];
          next[existingIdx] = optimisticRow;
          return next;
        }
        return [...old, optimisticRow].sort(
          (a, b) => a.week_number - b.week_number,
        );
      });

      return { previousReports };
    },
    onSuccess: () => {
      // Refetch to replace the optimistic row with the canonical server row
      // (real id, timestamps, etc.).
      queryClient.invalidateQueries({ queryKey });
      toast.success("Relatório salvo com sucesso!");
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot so we don't leave a fake row in the cache.
      if (context?.previousReports !== undefined) {
        queryClient.setQueryData(queryKey, context.previousReports);
      }
      toast.error(
        "Erro ao salvar relatório. Suas alterações foram mantidas, tente novamente.",
      );
    },
    onSettled: () => {
      setSavingWeek(null);
    },
  });

  const saveReport = useCallback(
    async (
      weekNumber: number,
      weekStart: string,
      weekEnd: string,
      data: WeeklyReportData,
    ): Promise<WeeklyReportData | null> => {
      if (!projectId) {
        toast.error("Projeto não selecionado");
        throw new Error("Projeto não selecionado");
      }

      setSavingWeek(weekNumber);

      // Guarda anti-apagão: o upsert por (project_id, week_number) é
      // last-write-wins. Se o payload está totalmente vazio (ex.: editor
      // montado com template vazio antes do carregamento, ou estado local
      // corrompido) e o servidor já tem conteúdo, RECUSA a sobrescrita —
      // era assim que relatórios preenchidos "apareciam zerados" no dia
      // seguinte.
      if (!hasReportContent(data)) {
        const { data: existing } = await supabase
          .from("weekly_reports")
          .select("data")
          .eq("project_id", projectId)
          .eq("week_number", weekNumber)
          .maybeSingle();

        if (
          hasReportContent(
            (existing?.data as unknown as WeeklyReportData | null) ?? null,
          )
        ) {
          const err = new Error(
            "Salvamento bloqueado: o relatório no servidor já tem conteúdo e a versão local está vazia. Recarregue a página e tente novamente.",
          );
          reportLogger.error("save-week-guard", err, { weekNumber });
          toast.error(
            "Salvamento bloqueado para não apagar o relatório existente. Recarregue a página e tente novamente.",
            { duration: 8000 },
          );
          setSavingWeek(null);
          throw err;
        }
      }

      // Upload any blob URLs to permanent storage before saving
      let dataToSave = data;
      let uploadFailed = false;
      if (data.gallery && data.gallery.length > 0) {
        const hasBlobUrls = data.gallery.some((p) =>
          p.url?.startsWith("blob:"),
        );
        if (hasBlobUrls) {
          toast.loading("Enviando fotos e vídeos...", {
            id: "uploading-photos",
          });
          const { success, photos } = await uploadGalleryPhotos(
            projectId,
            weekNumber,
            data.gallery,
          );
          toast.dismiss("uploading-photos");

          // Always persist whatever uploaded successfully — photos that
          // got permanent URLs are removed from the blob: set so the next
          // retry only re-uploads what still failed. Previously we aborted
          // the entire save on any failure, which caused successful uploads
          // to "live" in storage but never reach the DB row (n_photos=0).
          dataToSave = { ...data, gallery: photos };
          uploadFailed = !success;
        }
      }

      // IMPORTANT: await the upsert (mutateAsync) so failures propagate
      // back to useAutoSave. Using fire-and-forget mutate() caused silent
      // data loss — the editor marked the data as persisted before the DB
      // write actually completed (or failed via RLS / network).
      try {
        await upsertMutation.mutateAsync({
          weekNumber,
          weekStart,
          weekEnd,
          data: dataToSave,
        });
      } catch (err) {
        setSavingWeek(null);
        throw err;
      }

      // If any upload failed, throw AFTER persisting the partial success
      // so useAutoSave keeps the still-blob photos as "unsaved" and
      // retries on the next change/visibility event.
      if (uploadFailed) {
        setSavingWeek(null);
        throw new Error("Algumas fotos não foram enviadas. Tente novamente.");
      }

      // Return the persisted shape so the editor can replace its in-memory
      // blob URLs with the permanent signed URLs (and revoke the blobs).
      return dataToSave;
    },
    [projectId, uploadGalleryPhotos, upsertMutation],
  );

  return {
    reportDataByWeek,
    availableAtByWeek,
    isLoading,
    error,
    saveReport,
    isSaving: upsertMutation.isPending || isUploading,
    savingWeek,
  };
}
