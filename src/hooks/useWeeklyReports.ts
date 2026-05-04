import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyReportData } from "@/types/weeklyReport";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { useReportImageUpload } from "./useReportImageUpload";
import { queryKeys } from "@/lib/queryKeys";
import { reportLogger } from "@/lib/devLogger";

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
      return (data ?? []) as WeeklyReportRow[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  // Map week_number -> stored WeeklyReportData
  const reportDataByWeek = new Map<number, WeeklyReportData>();
  for (const row of reports) {
    reportDataByWeek.set(
      row.week_number,
      row.data as unknown as WeeklyReportData,
    );
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
    ) => {
      if (!projectId) {
        toast.error("Projeto não selecionado");
        return;
      }

      setSavingWeek(weekNumber);

      // Upload any blob URLs to permanent storage before saving
      let dataToSave = data;
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

          if (!success) {
            setSavingWeek(null);
            return; // Upload failed, don't save with broken URLs
          }
          dataToSave = { ...data, gallery: photos };
        }
      }

      upsertMutation.mutate({
        weekNumber,
        weekStart,
        weekEnd,
        data: dataToSave,
      });
    },
    [projectId, uploadGalleryPhotos, upsertMutation],
  );

  return {
    reportDataByWeek,
    isLoading,
    error,
    saveReport,
    isSaving: upsertMutation.isPending || isUploading,
    savingWeek,
  };
}
