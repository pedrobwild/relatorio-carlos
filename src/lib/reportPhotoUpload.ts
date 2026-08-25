import { supabase } from "@/integrations/supabase/client";
import { isHeicMimeOrName, isHeicBlob } from "@/lib/mediaTypes";

const BUCKET = "weekly-reports";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_FILE_SIZE = 200 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
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

export class PermanentUploadError extends Error {}

export interface UploadedPhoto {
  path: string;
  url: string;
}

/**
 * Envia um único arquivo do relatório para o Storage.
 * O nome é determinístico por foto (`upsert: true`), então uma retentativa
 * nunca gera duplicidade — mesmo que a resposta do envio anterior tenha se
 * perdido na rede móvel.
 */
export async function uploadReportPhotoBlob(params: {
  projectId: string;
  weekNumber: number;
  photoId: string;
  blob: Blob;
  mimeType?: string;
}): Promise<UploadedPhoto> {
  const { projectId, weekNumber, photoId, blob } = params;
  const mimeType = params.mimeType || blob.type || "application/octet-stream";

  if (blob.size > MAX_FILE_SIZE) {
    throw new PermanentUploadError(
      `Arquivo com ${(blob.size / 1024 / 1024).toFixed(0)}MB excede o limite de 200MB.`,
    );
  }
  if (isHeicMimeOrName(mimeType) || (await isHeicBlob(blob))) {
    throw new PermanentUploadError(
      "Formato HEIC não é suportado. Converta a foto para JPG ou PNG.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const extension = MIME_EXTENSIONS[mimeType] || ".bin";
  const filename = `${projectId}/${user.id}/week-${weekNumber}/${photoId}${extension}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, { contentType: mimeType, upsert: true });

  if (error) {
    const msg = error.message || "Falha ao enviar arquivo.";
    if (
      msg.includes("mime type") ||
      msg.includes("invalid_mime_type") ||
      msg.includes("Payload too large") ||
      msg.includes("exceeded the maximum")
    ) {
      throw new PermanentUploadError(msg);
    }
    throw new Error(msg);
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

  if (urlError || !urlData?.signedUrl) {
    throw new Error("Arquivo enviado, mas não foi possível gerar o link.");
  }

  return { path: data.path, url: urlData.signedUrl };
}
