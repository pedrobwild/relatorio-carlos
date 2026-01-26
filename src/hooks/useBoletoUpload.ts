import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBoletoUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, projectId, file }: { paymentId: string; projectId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${paymentId}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('payment-boletos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update payment record with boleto path
      const { error: updateError } = await supabase
        .from('project_payments')
        .update({ boleto_path: fileName })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      return fileName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-payments"] });
      toast.success("Boleto anexado com sucesso");
    },
    onError: (error: any) => {
      console.error("Error uploading boleto:", error);
      if (error.message?.includes("row-level security")) {
        toast.error("Apenas administradores podem anexar boletos");
      } else {
        toast.error("Erro ao anexar boleto");
      }
    },
  });
}

export function useBoletoDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, boletoPath }: { paymentId: string; boletoPath: string }) => {
      // Delete file from storage
      const { error: deleteError } = await supabase.storage
        .from('payment-boletos')
        .remove([boletoPath]);

      if (deleteError) throw deleteError;

      // Update payment record to remove boleto path
      const { error: updateError } = await supabase
        .from('project_payments')
        .update({ boleto_path: null })
        .eq('id', paymentId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-payments"] });
      toast.success("Boleto removido");
    },
    onError: (error: any) => {
      console.error("Error deleting boleto:", error);
      toast.error("Erro ao remover boleto");
    },
  });
}

export async function downloadBoleto(boletoPath: string) {
  const { data, error } = await supabase.storage
    .from('payment-boletos')
    .download(boletoPath);

  if (error) {
    toast.error("Erro ao baixar boleto");
    throw error;
  }

  // Create download link
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = boletoPath.split('/').pop() || 'boleto.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
