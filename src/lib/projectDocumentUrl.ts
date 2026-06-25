import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers para fotos guardadas no bucket PRIVADO `project-documents`
 * (fotos de membros de equipe, contatos e CSM).
 *
 * Regra: persistimos o PATH de storage em `photo_url`, nunca uma URL. URLs
 * assinadas expiram (issue #80 Bug 1) e URLs públicas não funcionam em bucket
 * privado (issue #82 Bug 1). A URL para exibição é assinada sob demanda na
 * leitura. Dados legados podem ter uma URL pública/assinada antiga apontando
 * para o bucket — extraímos o path dela.
 */
const BUCKET = "project-documents";
const SIGNED_TTL_SECONDS = 60 * 60; // 1h

/** Normaliza um valor guardado (path puro ou URL legada) para o PATH de storage. */
export function resolveProjectDocumentPath(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  if (stored.startsWith("blob:") || stored.startsWith("data:")) return null;

  const marker = `/${BUCKET}/`;
  const idx = stored.indexOf(marker);
  if (idx !== -1) {
    const tail = stored.slice(idx + marker.length);
    const q = tail.indexOf("?");
    return q === -1 ? tail : tail.slice(0, q);
  }

  // Sem marcador do bucket e não é http(s) → assume que já é um path de storage.
  return stored.startsWith("http") ? null : stored;
}

/** Assina um único valor (path ou URL legada) em uma signed URL fresca. */
export async function signProjectDocumentUrl(
  stored: string | null | undefined,
): Promise<string | null> {
  const path = resolveProjectDocumentPath(stored);
  if (!path) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Assina vários valores de uma vez (batch). Devolve um Map keyed pelo valor
 * ORIGINAL passado, para o chamador remapear cada registro à sua signed URL.
 */
export async function signProjectDocumentUrls(
  values: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  // Mapeia path -> valores originais que resolvem para esse path.
  const pathToOriginals = new Map<string, string[]>();
  for (const v of values) {
    if (!v) continue;
    const path = resolveProjectDocumentPath(v);
    if (!path) continue;
    const arr = pathToOriginals.get(path) ?? [];
    arr.push(v);
    pathToOriginals.set(path, arr);
  }

  const paths = Array.from(pathToOriginals.keys());
  if (paths.length === 0) return out;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_TTL_SECONDS);
  if (!data) return out;

  for (const item of data) {
    if (item.signedUrl && item.path) {
      for (const original of pathToOriginals.get(item.path) ?? []) {
        out.set(original, item.signedUrl);
      }
    }
  }
  return out;
}
