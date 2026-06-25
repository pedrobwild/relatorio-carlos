/**
 * useCsTicketHistory — histórico de atualizações de um ticket de CS.
 *
 * Combina entradas registradas automaticamente pelo trigger
 * `log_cs_ticket_changes` (mudanças de status, severidade, responsável,
 * plano de ação, situação, descrição) e comentários livres adicionados
 * pela equipe (`event_type = 'comment'`).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CsTicketHistoryEventType =
  | "created"
  | "status_changed"
  | "severity_changed"
  | "responsible_changed"
  | "action_plan_changed"
  | "situation_changed"
  | "description_changed"
  | "comment";

export interface CsTicketHistoryEntry {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: CsTicketHistoryEventType;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

export const csTicketHistoryKeys = {
  all: ["cs-ticket-history"] as const,
  list: (ticketId: string) => [...csTicketHistoryKeys.all, ticketId] as const,
};

export function useCsTicketHistory(ticketId: string | undefined) {
  return useQuery({
    queryKey: csTicketHistoryKeys.list(ticketId ?? ""),
    enabled: !!ticketId,
    queryFn: async (): Promise<CsTicketHistoryEntry[]> => {
      // NOTA: cs_ticket_history.actor_id referencia auth.users, não
      // public.users_profile — não é possível usar embed PostgREST.
      // Resolvemos os nomes manualmente em uma segunda consulta.
      const { data: rawData, error: rawError } = await (supabase as any)
        .from("cs_ticket_history")
        .select("*")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (rawError) throw rawError;

      const actorIds = Array.from(
        new Set((rawData ?? []).map((r: any) => r.actor_id).filter(Boolean)),
      );
      let nameMap: Record<string, string> = {};
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("users_profile")
          .select("id, nome")
          .in("id", actorIds as string[]);
        nameMap = Object.fromEntries(
          (profiles ?? []).map((p: any) => [p.id, p.nome]),
        );
      }
      return (rawData ?? []).map((r: any) => ({
        id: r.id,
        ticket_id: r.ticket_id,
        actor_id: r.actor_id,
        actor_name: r.actor_id ? (nameMap[r.actor_id] ?? null) : null,
        event_type: r.event_type,
        old_value: r.old_value,
        new_value: r.new_value,
        notes: r.notes,
        created_at: r.created_at,
      }));
    },
    staleTime: 15 * 1000,
  });
}

export function useAddCsTicketComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      notes,
    }: {
      ticketId: string;
      notes: string;
    }) => {
      // Mantemos getUser() (verificado no servidor) DE PROPÓSITO aqui: a
      // policy de INSERT em cs_ticket_history exige apenas is_staff(auth.uid())
      // e NÃO força actor_id = auth.uid(). Como actor_id é a trilha de
      // auditoria (autor do comentário), precisamos do uid verificado —
      // getSession() leria do armazenamento local, que poderia ser adulterado
      // para atribuir o comentário a outro usuário. (Em useCreateCsTicket /
      // useCreateCsTicketAction usamos getSession porque ali a policy exige
      // created_by = auth.uid(), então o servidor já garante a identidade.)
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const { error } = await (supabase as any)
        .from("cs_ticket_history")
        .insert({
          ticket_id: ticketId,
          actor_id: uid,
          event_type: "comment",
          notes: notes.trim(),
        });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: csTicketHistoryKeys.list(vars.ticketId),
      });
      toast.success("Comentário adicionado.");
    },
    onError: (err: any) => {
      toast.error("Erro ao adicionar comentário", {
        description: err?.message,
      });
    },
  });
}
