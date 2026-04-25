import { useEffect, useState } from "react";
import { getConsent, subscribeConsent, type ConsentState } from "@/lib/consent";

/**
 * Hook reativo para o estado atual de consentimento.
 * Componentes podem usar para mostrar/ocultar UI condicional (ex: banner).
 */
export function useConsent(): ConsentState {
  const [state, setState] = useState<ConsentState>(() => getConsent());
  useEffect(() => subscribeConsent(setState), []);
  return state;
}
