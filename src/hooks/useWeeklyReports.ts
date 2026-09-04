import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPhoto, WeeklyReportData } from "@/types/weeklyReport";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { useReportImageUpload } from "./useReportImageUpload";
import { queryKeys } from "@/lib/queryKeys";
import { reportLogger } from "@/lib/devLogger";
import {
  saveWeeklyReport as saveWeeklyReportRpc,
  isConflictError,
} from "@/infra/repositories/weeklyReports.repository";


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

/**
 * Marca as linhas escritas pelo update otimista, para que nunca sejam
 * confundidas com o estado do servidor. O campo é local ao cache do TanStack
 * Query e jamais é enviado ao banco.
 */
type OptimisticFlag = { __optimistic?: true };

function isOptimisticRow(row: WeeklyReportRow & OptimisticFlag): boolean {
  return row.__optimistic === true || row.id.startsWith("optimistic-");
}

/** `a` é estritamente mais recente que `b`? Ambos vêm do servidor (ISO). */
function isNewerTimestamp(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a !== b;
  return ta > tb;
}

export function useWeeklyReports({ projectId }: UseWeeklyReportsOptions) {
  const queryClient = useQueryClient();
  const [savingWeek, setSavingWeek] = useState<number | null>(null);
  const { uploadGalleryPhotos, isUploading } = useReportImageUpload();
  // week_number -> updated_at da última versão conhecida do servidor.
  const lastPersistedUpdatedAt = useRef(new Map<number, string>());

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
  // Map week_number -> updated_at da linha carregada. Base do controle de
  // concorrência otimista (evita last-write-wins entre dois editores).
  const updatedAtByWeek = new Map<number, string>();
  for (const row of reports) {
    reportDataByWeek.set(
      row.week_number,
      row.data as unknown as WeeklyReportData,
    );
    availableAtByWeek.set(row.week_number, row.available_at);
    // Só o que veio do SERVIDOR alimenta o controle de concorrência.
    //
    // A linha otimista de um relatório que JÁ EXISTE mantém o id real, então o
    // teste antigo (`!id.startsWith("optimistic-")`) não a filtrava: o
    // `updated_at` do relógio do cliente, gravado por `onMutate`, virava o
    // `expectedUpdatedAt` da própria gravação e a RPC recusava com
    // WEEKLY_REPORT_CONFLICT — um conflito que nunca existiu. Era isso que
    // fazia o relatório falhar ao salvar e só passar na segunda tentativa.
    if (!isOptimisticRow(row)) {
      updatedAtByWeek.set(row.week_number, row.updated_at);
      // E nunca anda para trás. O cache pode entregar uma linha MAIS VELHA
      // que a resposta da última gravação (refetch cancelado por `onMutate`,
      // cache persistido no localStorage, rollback de um erro). Se ela
      // virasse `expectedUpdatedAt`, a gravação seguinte seria recusada por
      // um conflito fabricado — com o cliente insistindo no mesmo carimbo.
      const known = lastPersistedUpdatedAt.current.get(row.week_number);
      if (!known || isNewerTimestamp(row.updated_at, known)) {
        lastPersistedUpdatedAt.current.set(row.week_number, row.updated_at);
      }
    }
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

      // `expectedUpdatedAt` vem do último estado servidor conhecido — a RPC
      // recusa a gravação se alguém salvou depois disso.
      const serverRows =
        queryClient.getQueryData<Array<WeeklyReportRow & OptimisticFlag>>(
          queryKey,
        ) ?? [];
      const serverRow = serverRows.find(
        (r) => r.week_number === weekNumber && !isOptimisticRow(r),
      );
      const expectedUpdatedAt =
        lastPersistedUpdatedAt.current.get(weekNumber) ??
        serverRow?.updated_at ??
        null;

      const result = await saveWeeklyReportRpc({
        projectId,
        weekNumber,
        weekStart,
        weekEnd,
        data,
        expectedUpdatedAt,
      });

      if (result.error) {
        reportLogger.error(operationId, result.error, { weekNumber });
        throw result.error;
      }

      if (result.data?.updated_at) {
        lastPersistedUpdatedAt.current.set(weekNumber, result.data.updated_at);
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
      queryClient.setQueryData<Array<WeeklyReportRow & OptimisticFlag>>(
        queryKey,
        (old = []) => {
        const existingIdx = old.findIndex((r) => r.week_number === weekNumber);
        const optimisticRow: WeeklyReportRow & OptimisticFlag = {
          __optimistic: true,
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
        },
      );

      return { previousReports };
    },
    onSuccess: (_data, vars) => {
      // Refetch to replace the optimistic row with the canonical server row
      // (real id, timestamps, etc.).
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: queryKeys.weeklyReports.versions(projectId, vars.weekNumber),
      });
      toast.success("Relatório salvo com sucesso!");
    },
    onError: async (err, vars, context) => {
      // Roll back to the snapshot so we don't leave a fake row in the cache.
      if (context?.previousReports !== undefined) {
        queryClient.setQueryData(queryKey, context.previousReports);
      }
      if (isConflictError(err)) {
        // Conflito: outra pessoa salvou depois do carregamento. Nada é
        // sobrescrito — recarregamos a versão do servidor e avisamos.
        //
        // O carimbo que tínhamos não vale mais: esquece, e ESPERA a versão do
        // servidor chegar antes de devolver o erro. Assim quem retenta
        // (autosave, "Tentar agora") já parte do carimbo certo. Sem o await,
        // o `onMutate` da tentativa seguinte cancelava este refetch e o
        // carimbo velho ficava congelado — o laço de centenas de chamadas
        // por segundo que derrubou o portal em 04/09 era exatamente isso.
        await queryClient.invalidateQueries({ queryKey });
        // Adota o carimbo que o servidor acabou de mandar, diretamente. Não
        // dá para só apagar e deixar o render resemear: o `onMutate` da
        // tentativa seguinte troca a linha do cache pela otimista ANTES do
        // `mutationFn` ler, e um carimbo ausente viraria `null` — ou seja,
        // gravação sem verificação de versão, sobrescrevendo outra pessoa.
        const fresh = queryClient
          .getQueryData<Array<WeeklyReportRow & OptimisticFlag>>(queryKey)
          ?.find(
            (r) => r.week_number === vars.weekNumber && !isOptimisticRow(r),
          );
        if (fresh) {
          lastPersistedUpdatedAt.current.set(vars.weekNumber, fresh.updated_at);
        } else {
          lastPersistedUpdatedAt.current.delete(vars.weekNumber);
        }
        toast.error(
          "Outra pessoa atualizou este relatório enquanto você editava. Recarregamos a versão mais recente — revise e salve novamente. Nenhuma informação foi perdida: o histórico de versões guarda tudo.",
          { duration: 10000 },
        );
        return;
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
    updatedAtByWeek,
    isLoading,

    error,
    saveReport,
    isSaving: upsertMutation.isPending || isUploading,
    savingWeek,
  };
}
