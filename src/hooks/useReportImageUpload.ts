import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPhoto } from "@/types/weeklyReport";
import { isHeic } from "@/lib/mediaTypes";
import { toast } from "sonner";

interface UploadResult {
  success: boolean;
  photos: GalleryPhoto[];
}

// Max file size allowed by bucket: 200MB
const MAX_FILE_SIZE = 200 * 1024 * 1024;
// Signed URL valid for 7 days (max allowed by Supabase Storage signed URLs is longer, but 7d covers report viewing window)
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export function useReportImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Uploads all blob URLs in the gallery to storage and returns updated gallery with permanent URLs.
   * Skips photos that already have permanent URLs.
   *
   * Path format: {projectId}/{userId}/week-{weekNumber}/{photoId}-{timestamp}.{ext}
   * First segment is projectId so RLS can check has_project_access().
   */
  const uploadGalleryPhotos = async (
    projectId: string,
    weekNumber: number,
    gallery: GalleryPhoto[],
  ): Promise<UploadResult> => {
    if (!gallery || gallery.length === 0) {
      return { success: true, photos: [] };
    }

    // Find photos with blob URLs that need uploading
    const photosToUpload = gallery.filter(
      (photo) => photo.url && photo.url.startsWith("blob:"),
    );

    if (photosToUpload.length === 0) {
      // No uploads needed - all photos already have permanent URLs
      return { success: true, photos: gallery };
    }

    // Get current user ID for path construction (required by RLS)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return { success: false, photos: gallery };
    }

    setIsUploading(true);
    setUploadProgress(0);

    const updatedGallery = [...gallery];
    let uploadedCount = 0;
    let failedCount = 0;

    try {
      for (const photo of photosToUpload) {
        const index = updatedGallery.findIndex((p) => p.id === photo.id);
        if (index === -1) continue;

        try {
          // Fetch the blob from the object URL
          const response = await fetch(photo.url);
          const blob = await response.blob();

          // Validate file size against bucket limit
          if (blob.size > MAX_FILE_SIZE) {
            toast.error(
              `"${photo.caption || "Arquivo"}" tem ${(blob.size / 1024 / 1024).toFixed(0)}MB (máx. 200MB) e não foi enviado. Envie um vídeo mais curto ou de menor resolução. O relatório não será salvo até resolver.`,
              { duration: 8000 },
            );
            failedCount++;
            continue;
          }

          // Determine file extension from MIME type
          const mimeType = blob.type || "application/octet-stream";

          // Reject HEIC/HEIF: iPhones capture in this format but it does not
          // render on Android/Windows/Chrome, so the customer would see a
          // broken image. Fail loudly here instead of silently later.
          if (isHeic(mimeType, photo.caption)) {
            toast.error(
              "Formato HEIC não é suportado. Converta a foto para JPG ou PNG antes de enviar (no iPhone: Ajustes → Câmera → Formatos → Mais Compatível).",
            );
            failedCount++;
            continue;
          }

          const extension = getExtensionFromMimeType(mimeType);

          // Create unique filename with projectId as first segment (required by RLS)
          const timestamp = Date.now();
          const filename = `${projectId}/${user.id}/week-${weekNumber}/${photo.id}-${timestamp}${extension}`;

          // Upload to storage
          const { data, error } = await supabase.storage
            .from("weekly-reports")
            .upload(filename, blob, {
              contentType: mimeType,
              upsert: false,
            });

          if (error) {
            console.error("Upload error for photo:", photo.id, error, {
              mimeType,
              size: blob.size,
            });

            const msg = error.message || "";
            if (msg.includes("row-level security")) {
              toast.error(
                "Sem permissão para enviar arquivos. Faça login novamente.",
              );
            } else if (
              msg.includes("Payload too large") ||
              msg.includes("exceeded the maximum")
            ) {
              toast.error(
                `Arquivo muito grande (${(blob.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 200MB.`,
              );
            } else if (
              msg.includes("mime type") ||
              msg.includes("not allowed") ||
              msg.includes("invalid_mime_type")
            ) {
              toast.error(
                `Formato não suportado: ${mimeType || "desconhecido"}. Use JPG, PNG ou MP4.`,
              );
            } else {
              toast.error(`Falha ao enviar foto: ${msg}`);
            }
            failedCount++;
            continue;
          }

          // Bucket is private — generate a signed URL for viewing
          const { data: urlData, error: urlError } = await supabase.storage
            .from("weekly-reports")
            .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

          if (urlError || !urlData?.signedUrl) {
            console.error("Signed URL error:", urlError);
            toast.error("Foto enviada, mas não foi possível gerar link.");
            failedCount++;
            continue;
          }

          // Persist the storage path (source of truth) alongside a fresh
          // signed URL for immediate display. The saved signed URL will
          // expire — refreshGalleryUrls re-signs from `path` on every load.
          updatedGallery[index] = {
            ...updatedGallery[index],
            path: data.path,
            url: urlData.signedUrl,
          };

          uploadedCount++;
          setUploadProgress(
            Math.round((uploadedCount / photosToUpload.length) * 100),
          );
        } catch (photoError) {
          console.error("Error processing photo:", photo.id, photoError);
          failedCount++;
        }
      }

      // Revoke old blob URLs to free memory (only for successfully uploaded)
      photosToUpload.forEach((photo) => {
        const updated = updatedGallery.find((p) => p.id === photo.id);
        // Only revoke if URL changed (upload succeeded)
        if (
          updated &&
          updated.url !== photo.url &&
          photo.url.startsWith("blob:")
        ) {
          URL.revokeObjectURL(photo.url);
        }
      });

      if (failedCount > 0) {
        toast.error(
          `${failedCount} foto(s) não foram enviadas. Tente novamente.`,
        );
        return { success: false, photos: updatedGallery };
      }

      return { success: true, photos: updatedGallery };
    } catch (error) {
      console.error("Error uploading gallery photos:", error);
      toast.error("Erro ao enviar fotos. Tente novamente.");
      return { success: false, photos: updatedGallery };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploadGalleryPhotos,
    isUploading,
    uploadProgress,
  };
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-m4v": ".m4v",
    "video/3gpp": ".3gp",
    "video/3gpp2": ".3g2",
    "video/x-matroska": ".mkv",
  };
  return mimeMap[mimeType] || ".bin";
}
