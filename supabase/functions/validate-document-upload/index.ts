import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf',  bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/png',        bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/jpeg',       bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/gif',        bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp',       bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/zip',  bytes: [0x50, 0x4B, 0x03, 0x04] },
  { mime: 'application/msword', bytes: [0xD0, 0xCF, 0x11, 0xE0] },
];

function matchMagicBytes(header: Uint8Array): string | null {
  for (const { mime, bytes } of MAGIC) {
    if (bytes.every((b, i) => header[i] === b)) return mime;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const requestId = crypto.randomUUID();

  try {
    const auth = await authenticateRequest(req);
    const { supabaseAdmin } = auth;

    const { objectKey, bucket } = await req.json();
    if (!objectKey || !bucket) {
      return jsonResponse({ valid: false, reason: 'missing-params', requestId }, 400);
    }

    // Download first 16 bytes
    const { data: blob, error: dlError } = await supabaseAdmin.storage
      .from(bucket)
      .download(objectKey);

    if (dlError || !blob) {
      return jsonResponse({ valid: false, reason: 'download-failed', requestId }, 500);
    }

    const buffer = await blob.arrayBuffer();
    const header = new Uint8Array(buffer).slice(0, 16);

    if (header.length < 3) {
      // File too small to validate — delete it
      await supabaseAdmin.storage.from(bucket).remove([objectKey]);
      return jsonResponse({ valid: false, reason: 'file-too-small', requestId }, 400);
    }

    const detectedMime = matchMagicBytes(header);

    if (!detectedMime) {
      // Magic mismatch — delete the object
      console.warn(`[${requestId}] Magic mismatch for ${objectKey}, deleting`);
      await supabaseAdmin.storage.from(bucket).remove([objectKey]);
      return jsonResponse({ valid: false, reason: 'magic-mismatch', requestId }, 400);
    }

    return jsonResponse({ valid: true, detectedMime, requestId });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const authErr = error as { status: number; message: string };
      return jsonResponse({ error: authErr.message, requestId }, authErr.status);
    }
    console.error(`[${requestId}] Unexpected error:`, error);
    return jsonResponse({ valid: false, reason: 'internal-error', requestId }, 500);
  }
});
