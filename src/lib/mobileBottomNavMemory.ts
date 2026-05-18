/**
 * Remembers the last bottom-nav route the user picked inside an obra, per
 * project. Used to restore that destination when the customer reopens the
 * app on mobile and lands on the project root (/obra/:projectId).
 *
 * Only the four "route-only" slots — financeiro, documentos, formalizacoes,
 * pendencias — are persisted; the Início/Obra hub and Perfil sheet do not
 * count as restorable destinations.
 */

export type RestorableMobileNavSlot =
  | "financeiro"
  | "documentos"
  | "formalizacoes"
  | "pendencias";

const RESTORABLE_SLOTS: readonly RestorableMobileNavSlot[] = [
  "financeiro",
  "documentos",
  "formalizacoes",
  "pendencias",
];

const keyFor = (projectId: string) => `mobileBottomNav:lastSlot:${projectId}`;

function isRestorable(value: unknown): value is RestorableMobileNavSlot {
  return (
    typeof value === "string" &&
    (RESTORABLE_SLOTS as readonly string[]).includes(value)
  );
}

export function rememberMobileNavSlot(
  projectId: string | undefined | null,
  slot: string,
): void {
  if (!projectId || typeof window === "undefined") return;
  if (!isRestorable(slot)) return;
  try {
    window.localStorage.setItem(keyFor(projectId), slot);
  } catch {
    // localStorage may be unavailable (private mode, quota). Best-effort only.
  }
}

export function readMobileNavSlot(
  projectId: string | undefined | null,
): RestorableMobileNavSlot | null {
  if (!projectId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(projectId));
    return isRestorable(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function clearMobileNavSlot(
  projectId: string | undefined | null,
): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(projectId));
  } catch {
    // ignore
  }
}

export function pathForMobileNavSlot(
  projectId: string,
  slot: RestorableMobileNavSlot,
): string {
  return `/obra/${projectId}/${slot}`;
}
