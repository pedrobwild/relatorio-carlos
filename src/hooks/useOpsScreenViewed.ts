/**
 * Evento de adoção: uma tela da camada de operação foi aberta (Fase 6).
 * Sem PII — só o nome da tela. No-op sem consentimento ou sem chave.
 */
import { useEffect } from "react";
import { trackAmplitude } from "@/lib/amplitude";

export type OpsScreen = "obras" | "semana" | "hoje";

export function useOpsScreenViewed(screen: OpsScreen) {
  useEffect(() => {
    trackAmplitude("ops_screen_viewed", { screen });
  }, [screen]);
}
