/**
 * Thin wrapper around @amplitude/unified for manual event tracking.
 *
 * Centraliza a chamada `amplitude.track` para que call sites não precisem
 * repetir o guard de client-side nem o try/catch defensivo.
 *
 * Init acontece em `src/main.tsx`. Se a chave (`VITE_AMPLITUDE_API_KEY`)
 * não estiver configurada, `track()` simplesmente não faz nada.
 */
import * as amplitude from "@amplitude/unified";

export type AmplitudeEvent =
  // Navegação
  | "Project Opened"
  // Atividades (obra tasks)
  | "Activity Saved"
  | "Activity Created"
  | "Activity Updated"
  // Fornecedores
  | "Supplier Saved"
  | "Supplier Updated";

export type AmplitudeProps = Record<string, string | number | boolean | null | undefined>;

const isEnabled = typeof window !== "undefined" && !!import.meta.env.VITE_AMPLITUDE_API_KEY;

/**
 * Dispara um evento no Amplitude. No-op se a chave não estiver configurada
 * ou se rodando em ambiente sem `window` (SSR/test).
 */
export function trackAmplitude(event: AmplitudeEvent, props?: AmplitudeProps): void {
  if (!isEnabled) return;
  try {
    amplitude.track(event, props);
  } catch (err) {
    // Telemetria nunca deve quebrar a UI.
    if (import.meta.env.DEV) {
      console.warn("[amplitude] failed to track", event, err);
    }
  }
}
