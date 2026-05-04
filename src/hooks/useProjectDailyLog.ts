/**
 * useProjectDailyLog — CRUD do registro diário de obra.
 *
 * Uma "folha" por (projeto, data). Contém:
 *   - notes (texto livre)
 *   - services[]  : serviços em execução no dia
 *   - workers[]   : prestadores no local no dia
 *
 * O front sempre opera em "snapshot do dia": carrega tudo de uma data,
 * permite editar em memória e salva em uma única chamada (replace-all
 * das tabelas-filhas). Mais simples que diff granular, e a escala
 * (poucas dezenas de itens por dia) justifica.
 *
 * Triggers do banco cuidam de:
 *   - updated_at no log principal
 *   - bump de projects.painel_ultima_atualizacao ao salvar
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ----- tipos de dom\u00ednio (espelham o banco) -----

export type DailyLogServiceStatus =
  | "Em andamento"
  | "Conclu\u00eddo"
  | "Parado"
  | null;

export interface DailyLogService {
  id?: string; // ausente para itens novos ainda não salvos
  description: string;
  status: DailyLogServiceStatus;
  observations: string | null;
  start_date: string | null; // ISO date (YYYY-MM-DD)
  end_date: string | null; // ISO date (YYYY-MM-DD)
  position: number;
}

export interface DailyLogWorker {
  id?: string;
  name: string;
  role: string | null;
  period_start: string | null; // ISO date (YYYY-MM-DD)
  period_end: string | null;
  shift_start: string | null; // HH:mm
  shift_end: string | null;
  notes: string | null;
  position: number;
}

export interface ProjectDailyLog {
  id: string | null; // null quando ainda n\u00e3o existe registro para a data
  project_id: string;
  log_date: string;
  notes: string | null;
  services: DailyLogService[];
  workers: DailyLogWorker[];
  updated_at: string | null;
}

const emptyLog = (projectId: string, logDate: string): ProjectDailyLog => ({
  id: null,
  project_id: projectId,
  log_date: logDate,
  notes: null,
  services: [],
  workers: [],
  updated_at: null,
});

// ----- query: carrega o log do dia -----

export function useProjectDailyLog(projectId: string | null, logDate: string) {
  return useQuery({
    queryKey: ["project-daily-log", projectId, logDate],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectDailyLog> => {
      if (!projectId) throw new Error("projectId requerido");

      const { data: log, error } = await supabase
        .from("project_daily_logs")
        .select("id, project_id, log_date, notes, updated_at")
        .eq("project_id", projectId)
        .eq("log_date", logDate)
        .maybeSingle();

      if (error) throw error;
      if (!log) return emptyLog(projectId, logDate);

      const [servicesRes, workersRes] = await Promise.all([
        supabase
          .from("project_daily_log_services")
          .select(
            "id, description, status, observations, start_date, end_date, position",
          )
          .eq("daily_log_id", log.id)
          .order("position", { ascending: true }),
        supabase
          .from("project_daily_log_workers")
          .select(
            "id, name, role, period_start, period_end, shift_start, shift_end, notes, position",
          )
          .eq("daily_log_id", log.id)
          .order("position", { ascending: true }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (workersRes.error) throw workersRes.error;

      return {
        id: log.id,
        project_id: log.project_id,
        log_date: log.log_date,
        notes: log.notes,
        updated_at: log.updated_at,
        services: (servicesRes.data ?? []) as DailyLogService[],
        workers: (workersRes.data ?? []) as DailyLogWorker[],
      };
    },
  });
}

// ----- mutation: salva (upsert do log + replace dos filhos) -----

export interface DailyLogSavePayload {
  project_id: string;
  log_date: string;
  notes: string | null;
  services: DailyLogService[];
  workers: DailyLogWorker[];
}

export function useSaveProjectDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DailyLogSavePayload) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id ?? null;

      // 1) upsert do log principal
      const { data: logRow, error: upsertErr } = await supabase
        .from("project_daily_logs")
        .upsert(
          {
            project_id: payload.project_id,
            log_date: payload.log_date,
            notes: payload.notes,
            updated_by: uid,
            // created_by s\u00f3 na primeira vez \u2014 upsert lida:
            ...(uid ? { created_by: uid } : {}),
          },
          { onConflict: "project_id,log_date" },
        )
        .select("id")
        .single();
      if (upsertErr) throw upsertErr;
      const logId = logRow.id;

      // 2) Sincronização dos filhos:
      // 2a) Serviços — usamos UPSERT preservando IDs existentes (porque
      // existem tarefas vinculadas via FK que seriam perdidas com delete-all).
      // Removemos apenas os que sumiram do payload.
      const incomingIds = payload.services
        .map((s) => s.id)
        .filter(Boolean) as string[];
      if (incomingIds.length > 0) {
        const { error: delSvcErr } = await supabase
          .from("project_daily_log_services")
          .delete()
          .eq("daily_log_id", logId)
          .not("id", "in", `(${incomingIds.join(",")})`);
        if (delSvcErr) throw delSvcErr;
      } else {
        const { error: delSvcErr } = await supabase
          .from("project_daily_log_services")
          .delete()
          .eq("daily_log_id", logId);
        if (delSvcErr) throw delSvcErr;
      }

      if (payload.services.length > 0) {
        const { error: upSvcErr } = await supabase
          .from("project_daily_log_services")
          .upsert(
            payload.services.map((s, idx) => ({
              ...(s.id ? { id: s.id } : {}),
              daily_log_id: logId,
              description: s.description,
              status: s.status,
              observations: s.observations,
              start_date: s.start_date,
              end_date: s.end_date,
              position: idx,
            })),
            { onConflict: "id" },
          );
        if (upSvcErr) throw upSvcErr;
      }

      // 2b) prestadores
      const { error: delWkErr } = await supabase
        .from("project_daily_log_workers")
        .delete()
        .eq("daily_log_id", logId);
      if (delWkErr) throw delWkErr;

      if (payload.workers.length > 0) {
        const { error: insWkErr } = await supabase
          .from("project_daily_log_workers")
          .insert(
            payload.workers.map((w, idx) => ({
              daily_log_id: logId,
              name: w.name,
              role: w.role,
              period_start: w.period_start,
              period_end: w.period_end,
              shift_start: w.shift_start,
              shift_end: w.shift_end,
              notes: w.notes,
              position: idx,
            })),
          );
        if (insWkErr) throw insWkErr;
      }

      return logId;
    },
    onSuccess: (_logId, variables) => {
      toast.success("Registro do dia salvo");
      queryClient.invalidateQueries({
        queryKey: [
          "project-daily-log",
          variables.project_id,
          variables.log_date,
        ],
      });
      // Bump em "Atualizado" vem pelo trigger; refresca o painel.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar o registro do dia";
      toast.error(message);
    },
  });
}
