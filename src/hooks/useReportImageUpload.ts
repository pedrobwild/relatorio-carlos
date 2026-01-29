import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPhoto } from "@/types/weeklyReport";
import { toast } from "sonner";

interface UploadResult {
  success: boolean;
  photos: GalleryPhoto[];
}

export function useReportImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Uploads all blob URLs in the gallery to storage and returns updated gallery with permanent URLs.
   * Skips photos that already have permanent URLs.
   */
  const uploadGalleryPhotos = async (
    projectId: string,
    weekNumber: number,
    gallery: GalleryPhoto[]
  ): Promise<UploadResult> => {
    if (!gallery || gallery.length === 0) {
      return { success: true, photos: [] };
    }

    // Find photos with blob URLs that need uploading
    const photosToUpload = gallery.filter(
      (photo) => photo.url && photo.url.startsWith("blob:")
    );

    if (photosToUpload.length === 0) {
      // No uploads needed - all photos already have permanent URLs
      return { success: true, photos: gallery };
    }

    setIsUploading(true);
    setUploadProgress(0);

    const updatedGallery = [...gallery];
    let uploadedCount = 0;

    try {
      for (const photo of photosToUpload) {
        const index = updatedGallery.findIndex((p) => p.id === photo.id);
        if (index === -1) continue;

        // Fetch the blob from the object URL
        const response = await fetch(photo.url);
        const blob = await response.blob();

        // Determine file extension from MIME type
        const mimeType = blob.type;
        const extension = getExtensionFromMimeType(mimeType);
        
        // Create unique filename
        const timestamp = Date.now();
        const filename = `${projectId}/week-${weekNumber}/${photo.id}-${timestamp}${extension}`;

        // Upload to storage
        const { data, error } = await supabase.storage
          .from("weekly-reports")
          .upload(filename, blob, {
            contentType: mimeType,
            upsert: false,
          });

        if (error) {
          console.error("Upload error for photo:", photo.id, error);
          // Keep the blob URL - upload failed
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
        setUploadProgress(Math.round((uploadedCount / photosToUpload.length) * 100));
      }

      // Revoke old blob URLs to free memory
      photosToUpload.forEach((photo) => {
        if (photo.url.startsWith("blob:")) {
          URL.revokeObjectURL(photo.url);
        }
      });

      return { success: true, photos: updatedGallery };
    } catch (error) {
      console.error("Error uploading gallery photos:", error);
      toast.error("Erro ao enviar algumas fotos. Tente novamente.");
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
