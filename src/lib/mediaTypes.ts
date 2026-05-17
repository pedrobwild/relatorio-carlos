// Shared media-type helpers. The list here MUST stay in sync with the
// extensions/MIME types accepted by useReportImageUpload — otherwise a file
// can be uploaded as a video but rendered as <img>, which always breaks.

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".webm",
  ".quicktime",
  ".m4v",
  ".3gp",
  ".3g2",
  ".mkv",
] as const;

export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split("?")[0];
  return (
    VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    lower.includes("video/")
  );
}

// HEIC/HEIF are accepted by iOS cameras but do not render natively on
// Android/Windows/Chrome. We reject them at upload time with a clear message.
export const HEIC_MIME_TYPES = ["image/heic", "image/heif"] as const;
export const HEIC_EXTENSIONS = [".heic", ".heif"] as const;

export function isHeic(mimeType: string | undefined, name?: string): boolean {
  const mt = (mimeType || "").toLowerCase();
  if ((HEIC_MIME_TYPES as readonly string[]).includes(mt)) return true;
  const lower = (name || "").toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
