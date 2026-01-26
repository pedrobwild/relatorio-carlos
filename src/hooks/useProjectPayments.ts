import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ProjectPayment {
  id: string;
  project_id: string;
  installment_number: number;
  description: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  payment_proof_path: string | null;
  created_at: string;
}

export function useProjectPayments(projectId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["project-payments", projectId],
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
  });
}

export function useMarkPaymentPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, paid }: { paymentId: string; paid: boolean }) => {
      const { error } = await supabase
        .from("project_payments")
        .update({ 
          paid_at: paid ? new Date().toISOString() : null 
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-payments"] });
      toast.success(variables.paid ? "Pagamento marcado como pago" : "Pagamento desmarcado");
    },
    onError: (error: any) => {
      console.error("Error updating payment:", error);
      if (error.message?.includes("row-level security")) {
        toast.error("Apenas administradores podem alterar o status de pagamento");
      } else {
        toast.error("Erro ao atualizar pagamento");
      }
    },
  });
}
