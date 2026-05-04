/**
 * Wrapper do Amplitude com gate de consentimento.
 *
 * - Init NÃO acontece automaticamente: depende de o usuário ter aceitado
 *   `analytics` (e opcionalmente `sessionReplay`) em `lib/consent`.
 * - `initAmplitudeIfConsented()` é idempotente — pode ser chamado várias vezes
 *   (no boot e a cada mudança de consentimento).
 * - `trackAmplitude()` é no-op enquanto o consentimento não estiver concedido,
 *   ou se a chave de API não estiver configurada.
 */
import * as amplitude from "@amplitude/unified";
import { getConsent, isAllowed, subscribeConsent } from "@/lib/consent";

export type AmplitudeEvent =
  // Navegação
  | "Project Opened"
  // Atividades (obra tasks)
  | "Activity Saved"
  | "Activity Created"
  | "Activity Updated"
  // Fornecedores
  | "Supplier Saved"
  | "Supplier Updated"
  // Cockpit de decisão (Bloco 1 — JTBD)
  | "next_action_displayed"
  | "next_action_clicked";

export type AmplitudeProps = Record<string, string | number | boolean | null | undefined>;

const API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY;
const isClient = typeof window !== "undefined";

let initialized = false;
let sessionReplayActive = false;

function logDev(...args: unknown[]) {
  if (import.meta.env.DEV) console.info("[amplitude]", ...args);
}

/**
 * Inicializa o Amplitude se (e somente se) houver chave configurada e
 * o usuário tiver consentido com `analytics`. Respeita também o opt-in
 * granular para `sessionReplay`.
 *
 * Idempotente: chamar várias vezes é seguro.
 */
export function initAmplitudeIfConsented(): void {
  if (!isClient) return;

  if (!API_KEY) {
    if (import.meta.env.DEV && !initialized) {
      console.warn(
        "[amplitude] VITE_AMPLITUDE_API_KEY não configurada — analytics desativado."
      );
    }
    return;
  }

  if (!isAllowed("analytics")) {
    logDev("consent não concedido — init pulado");
    return;
  }

  if (initialized) {
    // Já inicializado; ajusta apenas o opt-out de session replay se o usuário
    // mudou de ideia. (O SDK não expõe um "disable" trivial pós-init, então
    // o melhor que conseguimos é não enviar o evento dali pra frente — feito
    // pelo gate em `trackAmplitude` se necessário.)
    sessionReplayActive = isAllowed("sessionReplay");
    return;
  }

  try {
    const wantsReplay = isAllowed("sessionReplay");
    amplitude.initAll(API_KEY, {
      analytics: { autocapture: true },
      // Só registra o plugin de session replay se o usuário consentiu.
      ...(wantsReplay ? { sessionReplay: { sampleRate: 1 } } : {}),
    });
    initialized = true;
    sessionReplayActive = wantsReplay;
    logDev("inicializado", { sessionReplay: wantsReplay });
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[amplitude] init falhou", err);
  }
}

/**
 * Dispara um evento. No-op se o consentimento não foi concedido,
 * a chave não existe, ou rodando em SSR/test.
 */
export function trackAmplitude(event: AmplitudeEvent, props?: AmplitudeProps): void {
  if (!isClient || !API_KEY) return;
  if (!isAllowed("analytics")) return;
  // Garante init lazy (caso o consentimento tenha sido dado depois do boot).
  if (!initialized) initAmplitudeIfConsented();
  if (!initialized) return;
  try {
    amplitude.track(event, props);
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[amplitude] track falhou", event, err);
  }
}

/**
 * Bootstrap a ser chamado uma vez em `main.tsx`.
 * Tenta inicializar agora (se já houver consentimento prévio) e
 * se inscreve para inicializar quando o usuário aceitar.
 */
export function bootstrapAmplitudeConsent(): void {
  if (!isClient) return;
  // Tentativa imediata: pode haver consentimento persistido de visitas anteriores.
  initAmplitudeIfConsented();
  // Reage a mudanças (Aceitar / Recusar / Personalizar).
  subscribeConsent(() => {
    initAmplitudeIfConsented();
  });
}

/** Exposto para debug / settings. */
export function getAmplitudeStatus() {
  return {
    hasKey: !!API_KEY,
    initialized,
    sessionReplayActive,
    consent: getConsent(),
  };
}
