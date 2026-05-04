import { supabase } from "@/integrations/supabase/client";
import type { FormalizationAttachment } from "@/types/formalization";

const BUCKET_NAME = "formalization-attachments";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
];

const MIME_TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "Imagem JPEG",
  "image/png": "Imagem PNG",
  "image/gif": "Imagem GIF",
  "image/webp": "Imagem WebP",
  "image/heic": "Imagem HEIC",
  "application/pdf": "PDF",
  "application/msword": "Word (DOC)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word (DOCX)",
  "application/vnd.ms-excel": "Excel (XLS)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "Excel (XLSX)",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};

export interface UploadResult {
  success: boolean;
  attachment?: FormalizationAttachment;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Sanitize filename for storage path
 */
function sanitizeFilename(filename: string): string {
  // Remove special characters, keep alphanumeric, dots, hyphens, underscores
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9.\-_]/g, "_") // Replace special chars with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .toLowerCase();
}

/**
 * Generate unique storage path for attachment
 */
function generateStoragePath(
  formalizationId: string,
  filename: string,
): string {
  const uuid = crypto.randomUUID();
  const sanitized = sanitizeFilename(filename);
  return `formalizations/${formalizationId}/${uuid}-${sanitized}`;
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): ValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Arquivo muito grande (${sizeMB}MB). Máximo permitido: 20MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: imagens, PDF, Word, Excel, ZIP`,
    };
  }

  return { valid: true };
}

/**
 * Upload file and create attachment record
 */
export async function uploadFormalizationAttachment(
  formalizationId: string,
  file: File,
): Promise<UploadResult> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: "Usuário não autenticado" };
  }

  // Generate storage path
  const storagePath = generateStoragePath(formalizationId, file.name);

  try {
    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return {
        success: false,
        error: `Erro no upload: ${uploadError.message}`,
      };
    }

    // Create attachment record in database
    const { data: attachment, error: dbError } = await supabase
      .from("formalization_attachments")
      .insert({
        formalization_id: formalizationId,
        storage_bucket: BUCKET_NAME,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      console.error("DB error:", dbError);
      return {
        success: false,
        error: `Erro ao registrar anexo: ${dbError.message}`,
      };
    }

    // Insert event
    await supabase.from("formalization_events").insert({
      formalization_id: formalizationId,
      event_type: "attachment_added",
      actor_user_id: user.id,
      meta: {
        attachment_id: attachment.id,
        filename: file.name,
        size_bytes: file.size,
      },
    });

    return {
      success: true,
      attachment: attachment as FormalizationAttachment,
    };
  } catch (error) {
    console.error("Upload exception:", error);
    return { success: false, error: "Erro inesperado no upload" };
  }
}

/**
 * Get signed URL for downloading/viewing attachment
 */
export async function getAttachmentUrl(
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Download attachment
 */
export async function downloadAttachment(
  storagePath: string,
  originalFilename: string,
): Promise<boolean> {
  const url = await getAttachmentUrl(storagePath);
  if (!url) {
    return false;
  }

  // Create temporary link and trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download = originalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
}

/**
 * List attachments for a formalization
 */
export async function listFormalizationAttachments(
  formalizationId: string,
): Promise<FormalizationAttachment[]> {
  const { data, error } = await supabase
    .from("formalization_attachments")
    .select("*")
    .eq("formalization_id", formalizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing attachments:", error);
    return [];
  }

  return data as FormalizationAttachment[];
}

/**
 * Delete attachment (staff+ only, before lock)
 */
export async function deleteFormalizationAttachment(
  attachmentId: string,
): Promise<{ success: boolean; error?: string }> {
  // Get attachment details
  const { data: attachment, error: fetchError } = await supabase
    .from("formalization_attachments")
    .select("storage_path, formalization_id")
    .eq("id", attachmentId)
    .single();

  if (fetchError || !attachment) {
    return { success: false, error: "Anexo não encontrado" };
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([attachment.storage_path]);

  if (storageError) {
    console.error("Storage delete error:", storageError);
    return {
      success: false,
      error: `Erro ao deletar arquivo: ${storageError.message}`,
    };
  }

  // Delete record from database
  const { error: dbError } = await supabase
    .from("formalization_attachments")
    .delete()
    .eq("id", attachmentId);

  if (dbError) {
    console.error("DB delete error:", dbError);
    return {
      success: false,
      error: `Erro ao deletar registro: ${dbError.message}`,
    };
  }

  return { success: true };
}

/**
 * Get human-readable file type label
 */
export function getFileTypeLabel(mimeType: string): string {
  return MIME_TYPE_LABELS[mimeType] || mimeType;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
