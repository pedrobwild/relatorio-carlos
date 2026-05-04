import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CRITICAL_QUERY_KEYS } from "@/lib/queryKeys";

/**
 * Event dispatched when the browser restored a discarded tab.
 * Forms with autosaved drafts can listen for it to restore unsaved input
 * (see `useFormDraft`).
 */
export const RESTORE_DRAFT_EVENT = "bwild:restore-drafts";

/**
 * Detects when the browser "discarded" a tab (Memory Saver / low memory)
 * and restored it. We avoid `window.location.reload()` to preserve
 * in-flight form state — instead we:
 *
 *   1) Invalidate query keys tagged as "critical" (real-time data).
 *   2) Dispatch `RESTORE_DRAFT_EVENT` so forms can rehydrate from
 *      `localStorage` drafts.
 *   3) Notify the user with a toast.
 */
export function TabDiscardDetector() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const wasDiscarded =
      typeof document !== "undefined" &&
      Boolean((document as unknown as { wasDiscarded?: boolean }).wasDiscarded);

    if (!wasDiscarded) return;

    for (const key of CRITICAL_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: key });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(RESTORE_DRAFT_EVENT));
    }

    toast.message("Aba restaurada — dados atualizados", {
      description:
        'O navegador descartou a aba para economizar memória. Recarregamos os dados em segundo plano e mantivemos seus rascunhos.',
      duration: 9000,
    });
  }, [queryClient]);

  return null;
}
