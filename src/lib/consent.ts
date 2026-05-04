/**
 * Consentimento de telemetria (analytics + session replay).
 *
 * - Granular: o usuário pode aceitar analytics sem aceitar session replay.
 * - Persistido em localStorage com versionamento para forçar re-prompt
 *   quando a política mudar.
 * - Pub/sub para que serviços (Amplitude) reajam em tempo real.
 *
 * Default = `null` (indeciso) → nada é coletado até o usuário escolher.
 */

export type ConsentCategory = "analytics" | "sessionReplay";

export interface ConsentState {
  analytics: boolean;
  sessionReplay: boolean;
  /** ISO timestamp de quando o usuário decidiu. `null` = ainda não decidiu. */
  decidedAt: string | null;
  /** Versão da política aceita. Bump força re-prompt. */
  version: number;
}

/** Bump quando os termos/categorias mudarem para invalidar consents antigos. */
export const CONSENT_VERSION = 1;
const STORAGE_KEY = "bwild:consent";

const DEFAULT_STATE: ConsentState = {
  analytics: false,
  sessionReplay: false,
  decidedAt: null,
  version: CONSENT_VERSION,
};

type Listener = (state: ConsentState) => void;
const listeners = new Set<Listener>();

function readFromStorage(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    // Versão antiga → ignora e força novo prompt.
    if (parsed.version !== CONSENT_VERSION) return DEFAULT_STATE;
    return {
      analytics: !!parsed.analytics,
      sessionReplay: !!parsed.sessionReplay,
      decidedAt: parsed.decidedAt ?? null,
      version: CONSENT_VERSION,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

let currentState: ConsentState = readFromStorage();

function persist(state: ConsentState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponível (modo privado / quota) — segue em memória.
  }
}

function emit() {
  for (const listener of listeners) {
    try {
      listener(currentState);
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[consent] listener error", err);
    }
  }
}

/** Estado atual (síncrono). */
export function getConsent(): ConsentState {
  return currentState;
}

/** O usuário já fez uma escolha explícita? */
export function hasDecided(): boolean {
  return currentState.decidedAt !== null;
}

/** Atalho: a categoria está habilitada agora? */
export function isAllowed(category: ConsentCategory): boolean {
  return currentState[category] === true;
}

/** Salva uma decisão completa (usado pelo banner / dialog de preferências). */
export function setConsent(decision: {
  analytics: boolean;
  sessionReplay: boolean;
}) {
  currentState = {
    analytics: decision.analytics,
    // Session replay só faz sentido se analytics estiver ligado.
    sessionReplay: decision.analytics && decision.sessionReplay,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  persist(currentState);
  emit();
}

/** Aceita tudo. */
export function acceptAll() {
  setConsent({ analytics: true, sessionReplay: true });
}

/** Recusa tudo. */
export function rejectAll() {
  setConsent({ analytics: false, sessionReplay: false });
}

/** Apaga a decisão (volta a mostrar o banner). Útil para "Revogar consentimento". */
export function resetConsent() {
  currentState = { ...DEFAULT_STATE };
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  emit();
}

/** Inscreve listener; retorna unsubscribe. */
export function subscribeConsent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
