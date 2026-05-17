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

export function isHeicMimeOrName(
  mimeType: string | undefined,
  name?: string,
): boolean {
  const mt = (mimeType || "").toLowerCase();
  if ((HEIC_MIME_TYPES as readonly string[]).includes(mt)) return true;
  const lower = (name || "").toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// HEIC/HEIF are ISO-BMFF: bytes 4-8 are "ftyp", bytes 8-12 are the major
// brand. Blob uploads frequently arrive as application/octet-stream with no
// filename, so MIME/extension checks miss them — sniff the brand instead.
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

export async function isHeicBlob(blob: Blob): Promise<boolean> {
  try {
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (header.length < 12) return false;
    const ascii = (start: number, end: number) =>
      String.fromCharCode(...header.subarray(start, end));
    if (ascii(4, 8) !== "ftyp") return false;
    return HEIC_BRANDS.has(ascii(8, 12).toLowerCase());
  } catch {
    return false;
  }
}
