import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { trackAmplitude } from "@/lib/amplitude";

interface UseIndexTabUrlSyncOptions {
  projectId: string | undefined;
  /** Aba ativa (estado vive no useProjectPortal). */
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** Abas que existem como `?tab=` na Index (as demais são rotas próprias). */
  visibleTabs: readonly string[];
  isMobile: boolean;
  /**
   * `false` enquanto a página está prestes a sair (ex.: obra em fase de
   * projeto redirecionando para a Jornada). Nesse estado nenhum efeito daqui
   * pode escrever na URL — o último `navigate` do commit vence, e um
   * `setSearchParams` tardio desfaria o redirect.
   */
  enabled: boolean;
}

export const mobileActiveTabStorageKey = (projectId: string) =>
  `mobileActiveTab:${projectId}`;

/**
 * Mantém `?tab=` e `activeTab` da Index em sincronia, com a URL autoritativa.
 *
 * Regras que evitam o laço de `history.replaceState` (Safari corta em 100
 * chamadas por 10 s e a página cai no ErrorBoundary; Chrome só estrangula e
 * a aba fica piscando):
 *
 * 1. URL → estado adota a aba da URL (ou, sem `?tab=` no mobile, a aba
 *    lembrada em localStorage). Ao adotar, marca a adoção como pendente.
 * 2. Estado → URL pula exatamente a rodada em que uma adoção está pendente.
 *    Sem isso, os dois efeitos rodam no mesmo commit com closures velhas: o
 *    segundo grava a aba ANTIGA na URL, o primeiro readota, e assim por diante.
 * 3. Estado → URL não espelha no primeiro commit sem `?tab=`: outras
 *    restaurações (viewState do portal) ainda estão trocando a aba nesse
 *    commit, e espelhar o default por cima delas reabre o laço.
 */
export function useIndexTabUrlSync({
  projectId,
  activeTab,
  setActiveTab,
  visibleTabs,
  isMobile,
  enabled,
}: UseIndexTabUrlSyncOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const storageKey = projectId ? mobileActiveTabStorageKey(projectId) : null;

  // Aba adotada da URL/storage cujo estado ainda não foi aplicado.
  const pendingAdoptionRef = useRef<string | null>(null);
  const firstMirrorRunRef = useRef(true);

  // URL -> estado: ao aterrissar ou navegar (voltar/avançar), adota a aba da
  // query string se for uma aba válida da Index. No mobile, sem `?tab=`,
  // restaura a aba persistida em localStorage para um refresh voltar onde
  // o cliente estava.
  useEffect(() => {
    if (!enabled) return;
    if (urlTab) {
      if (!visibleTabs.includes(urlTab)) return;
      if (urlTab === activeTab) return;
      pendingAdoptionRef.current = urlTab;
      trackAmplitude("mobile_tab_synced", {
        projectId: projectId ?? null,
        from: activeTab,
        to: urlTab,
        reason: "url_param",
      });
      setActiveTab(urlTab);
      return;
    }
    if (!isMobile || !storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      if (!visibleTabs.includes(stored)) return;
      if (stored === activeTab) return;
      pendingAdoptionRef.current = stored;
      trackAmplitude("mobile_tab_synced", {
        projectId: projectId ?? null,
        from: activeTab,
        to: stored,
        reason: "localstorage_restore",
      });
      setActiveTab(stored);
    } catch {
      // storage indisponível (modo privado, cota) — segue sem restaurar
    }
    // activeTab é lido só para comparar; reagir a ele aqui recriaria o laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab, isMobile, storageKey, enabled]);

  // estado -> URL: quando o usuário troca de aba, espelha em `?tab=` (replace,
  // sem entrada extra de histórico) e persiste por obra em localStorage para
  // sobreviver a um reload no mobile.
  useEffect(() => {
    if (!enabled) return;
    const firstRun = firstMirrorRunRef.current;
    firstMirrorRunRef.current = false;

    if (pendingAdoptionRef.current !== null) {
      const adopted = pendingAdoptionRef.current;
      pendingAdoptionRef.current = null;
      // Mesma rodada da adoção: o estado ainda é o anterior. Escrever agora
      // gravaria a aba velha na URL e o efeito acima a readotaria.
      if (adopted !== activeTab) return;
    }
    if (!visibleTabs.includes(activeTab)) return;
    if (firstRun && !urlTab) return;

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, activeTab);
      } catch {
        // ignora erros de storage
      }
    }
    if (urlTab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    searchParams,
    setSearchParams,
    storageKey,
    urlTab,
    enabled,
    visibleTabs,
  ]);
}
