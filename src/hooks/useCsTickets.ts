/**
 * useCsTickets — gestão de tickets do módulo de Customer Success.
 *
 * Cada ticket está vinculado a uma obra (project_id) e contém:
 *   - situação (situation), descrição, severidade (baixa/media/alta/critica),
 *   - status (aberto/em_andamento/concluido), plano de ação,
 *   - responsável (usuário staff), criador, datas.
 *
 * As políticas RLS garantem que apenas equipe staff
 * (`is_staff(auth.uid())`) acesse, crie, edite ou exclua tickets.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ----- types -----
export type CsTicketSeverity = "baixa" | "media" | "alta" | "critica";
export type CsTicketStatus = "aberto" | "em_andamento" | "concluido";

export const CS_SEVERITY_OPTIONS: { value: CsTicketSeverity; label: string }[] =
  [
    { value: "baixa", label: "Baixa" },
    { value: "media", label: "Média" },
    { value: "alta", label: "Alta" },
    { value: "critica", label: "Crítica" },
  ];

export const CS_STATUS_OPTIONS: { value: CsTicketStatus; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
];

export interface CsTicket {
  id: string;
  project_id: string;
  project_name: string | null;
  customer_name: string | null;
  situation: string;
  description: string | null;
  severity: CsTicketSeverity;
  status: CsTicketStatus;
  action_plan: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  created_by: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsTicketInput {
  project_id: string;
  situation: string;
  description?: string | null;
  severity: CsTicketSeverity;
  status?: CsTicketStatus;
  action_plan?: string | null;
  responsible_user_id?: string | null;
}

export type CsTicketPatch = Partial<Omit<CsTicketInput, "project_id">>;

// ----- query keys -----
export const csTicketKeys = {
  all: ["cs-tickets"] as const,
  list: () => [...csTicketKeys.all, "list"] as const,
};

// ----- list -----
export function useCsTickets() {
  return useQuery({
    queryKey: csTicketKeys.list(),
    queryFn: async (): Promise<CsTicket[]> => {
      const { data, error } = await supabase
        .from("cs_tickets")
        .select(
          `
          id, project_id, situation, description, severity, status,
          action_plan, responsible_user_id, created_by, resolved_at,
          created_at, updated_at,
          project:projects ( id, name, customer_name ),
          responsible:users_profile!cs_tickets_responsible_user_id_fkey ( id, nome )
          `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        project_id: row.project_id,
        project_name: row.project?.name ?? null,
        customer_name: row.project?.customer_name ?? null,
        situation: row.situation,
        description: row.description,
        severity: row.severity,
        status: row.status,
        action_plan: row.action_plan,
        responsible_user_id: row.responsible_user_id,
        responsible_name: row.responsible?.nome ?? null,
        created_by: row.created_by,
        resolved_at: row.resolved_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as CsTicket[];
    },
    staleTime: 30 * 1000,
  });
}

// ----- create -----
export function useCreateCsTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CsTicketInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const { data, error } = await supabase
        .from("cs_tickets")
        .insert({
          project_id: input.project_id,
          situation: input.situation,
          description: input.description ?? null,
          severity: input.severity,
          status: input.status ?? "aberto",
          action_plan: input.action_plan ?? null,
          responsible_user_id: input.responsible_user_id ?? null,
          created_by: uid,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: csTicketKeys.all });
      toast.success("Ticket criado com sucesso.");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar ticket", { description: err?.message });
    },
  });
}

// ----- update -----
export function useUpdateCsTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CsTicketPatch }) => {
      const { error } = await supabase
        .from("cs_tickets")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: csTicketKeys.all });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar ticket", { description: err?.message });
    },
  });
}

// ----- touch (marca como tratado: apenas atualiza updated_at) -----
export function useTouchCsTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cs_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: csTicketKeys.all });
      toast.success("Ticket marcado como tratado.");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar ticket", { description: err?.message });
    },
  });
}

// ----- delete -----
export function useDeleteCsTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cs_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: csTicketKeys.all });
      toast.success("Ticket removido.");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover ticket", { description: err?.message });
    },
  });
}
