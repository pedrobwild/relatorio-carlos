import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logError, logInfo } from "@/lib/errorLogger";

// Allowed MIME types for boletos
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface BoletoValidationError extends Error {
  code: "INVALID_TYPE" | "FILE_TOO_LARGE";
}

function validateBoletoFile(file: File): void {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    const error = new Error(
      `Tipo de arquivo não permitido. Aceitos: PDF, PNG, JPEG`,
    ) as BoletoValidationError;
    error.code = "INVALID_TYPE";
    throw error;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const error = new Error(
      `Arquivo muito grande (${sizeMB}MB). Máximo permitido: 10MB`,
    ) as BoletoValidationError;
    error.code = "FILE_TOO_LARGE";
    throw error;
  }
}

export function useBoletoUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      projectId,
      file,
    }: {
      paymentId: string;
      projectId: string;
      file: File;
    }) => {
      // Validate file before upload
      validateBoletoFile(file);

      // Use MIME type to determine extension (more reliable than file name)
      const mimeToExt: Record<string, string> = {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
      };
      const fileExt = mimeToExt[file.type] || "pdf";
      const fileName = `${projectId}/${paymentId}.${fileExt}`;

      logInfo("Uploading boleto", {
        paymentId,
        projectId,
        fileType: file.type,
        fileSize: file.size,
      });

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("payment-boletos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        logError("Boleto upload failed", uploadError, {
          component: "useBoletoUpload",
          paymentId,
        });
        throw uploadError;
      }

      // Update payment record with boleto path
      const { error: updateError } = await supabase
        .from("project_payments")
        .update({ boleto_path: fileName })
        .eq("id", paymentId);

      if (updateError) {
        logError("Payment update failed after upload", updateError, {
          component: "useBoletoUpload",
          paymentId,
        });
        throw updateError;
      }

      logInfo("Boleto uploaded successfully", { paymentId, fileName });
      return fileName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-payments"] });
      toast.success("Boleto anexado com sucesso");
    },
    onError: (error: Error & { code?: string }) => {
      logError("Error uploading boleto", error, {
        component: "useBoletoUpload",
      });

      // Show user-friendly error messages
      if (error.code === "INVALID_TYPE" || error.code === "FILE_TOO_LARGE") {
        toast.error(error.message);
      } else if (error.message?.includes("row-level security")) {
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
    mutationFn: async ({
      paymentId,
      boletoPath,
    }: {
      paymentId: string;
      boletoPath: string;
    }) => {
      // Delete file from storage
      const { error: deleteError } = await supabase.storage
        .from("payment-boletos")
        .remove([boletoPath]);

      if (deleteError) throw deleteError;

      // Update payment record to remove boleto path
      const { error: updateError } = await supabase
        .from("project_payments")
        .update({ boleto_path: null })
        .eq("id", paymentId);

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
    .from("payment-boletos")
    .download(boletoPath);

  if (error) {
    toast.error("Erro ao baixar boleto");
    throw error;
  }

  // Create download link
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = boletoPath.split("/").pop() || "boleto.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
