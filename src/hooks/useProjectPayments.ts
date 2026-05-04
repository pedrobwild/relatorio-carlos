import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { QUERY_TIMING } from "@/lib/queryClient";

export interface ProjectPayment {
  id: string;
  project_id: string;
  installment_number: number;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  payment_proof_path: string | null;
  boleto_path: string | null;
  notification_sent_at: string | null;
  created_at: string;
}

export function useProjectPayments(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.payments.list(projectId),
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("project_payments")
        .select("*")
        .eq("project_id", projectId)
        .order("installment_number", { ascending: true });

      if (error) throw error;
      return (data || []) as ProjectPayment[];
    },
    enabled: !!user && !!projectId,
    staleTime: QUERY_TIMING.payments.staleTime,
    gcTime: QUERY_TIMING.payments.gcTime,
  });
}

export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      paid,
    }: {
      paymentId: string;
      paid: boolean;
    }) => {
      const { error } = await supabase
        .from("project_payments")
        .update({
          paid_at: paid ? new Date().toISOString() : null,
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      toast.success(
        variables.paid ? "Pagamento marcado como pago" : "Pagamento desmarcado",
      );
    },
    onError: (error: any) => {
      console.error("Error updating payment:", error);
      if (error.message?.includes("row-level security")) {
        toast.error(
          "Apenas administradores podem alterar o status de pagamento",
        );
      } else {
        toast.error("Erro ao atualizar pagamento");
      }
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      updates,
    }: {
      paymentId: string;
      updates: {
        description?: string;
        amount?: number;
        due_date?: string | null;
      };
    }) => {
      const { error } = await supabase
        .from("project_payments")
        .update(updates)
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      toast.success("Parcela atualizada");
    },
    onError: (error: any) => {
      console.error("Error updating payment:", error);
      if (error.message?.includes("row-level security")) {
        toast.error("Apenas administradores podem editar parcelas");
      } else {
        toast.error("Erro ao atualizar parcela");
      }
    },
  });
}
