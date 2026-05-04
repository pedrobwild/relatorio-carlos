import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPhoto } from "@/types/weeklyReport";
import { toast } from "sonner";

interface UploadResult {
  success: boolean;
  photos: GalleryPhoto[];
}

// Max file size allowed by bucket: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function useReportImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Uploads all blob URLs in the gallery to storage and returns updated gallery with permanent URLs.
   * Skips photos that already have permanent URLs.
   *
   * Path format: {userId}/{projectId}/week-{weekNumber}/{photoId}-{timestamp}.{ext}
   * This format satisfies RLS policies that check storage.foldername(name)[1] = auth.uid()
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
              `Arquivo muito grande: ${(blob.size / 1024 / 1024).toFixed(1)}MB. Máximo: 50MB.`,
            );
            failedCount++;
            continue;
          }

          // Determine file extension from MIME type
          const mimeType = blob.type;
          const extension = getExtensionFromMimeType(mimeType);

          // Create unique filename with userId as first segment (required by RLS)
          const timestamp = Date.now();
          const filename = `${user.id}/${projectId}/week-${weekNumber}/${photo.id}-${timestamp}${extension}`;

          // Upload to storage
          const { data, error } = await supabase.storage
            .from("weekly-reports")
            .upload(filename, blob, {
              contentType: mimeType,
              upsert: false,
            });

          if (error) {
            console.error("Upload error for photo:", photo.id, error);

            // Provide user-friendly error messages
            if (error.message?.includes("row-level security")) {
              toast.error(
                "Sem permissão para enviar arquivos. Verifique suas credenciais.",
              );
            } else if (error.message?.includes("Payload too large")) {
              toast.error(`Arquivo muito grande para envio.`);
            } else {
              toast.error(`Falha ao enviar foto: ${error.message}`);
            }
            failedCount++;
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("weekly-reports")
            .getPublicUrl(data.path);

          // Update the gallery entry with the permanent URL
          updatedGallery[index] = {
            ...updatedGallery[index],
            url: urlData.publicUrl,
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
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
  };
  return mimeMap[mimeType] || ".bin";
}
