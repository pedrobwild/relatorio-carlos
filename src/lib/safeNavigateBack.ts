import { NavigateFunction } from "react-router-dom";

/**
 * Navega para trás de forma segura, evitando loops quando o histórico está vazio.
 *
 * Se o histórico tiver entradas, volta normalmente.
 * Se não tiver, redireciona para o fallback (por padrão /gestao para staff, /minhas-obras para customer).
 *
 * @param navigate - Função navigate do react-router
 * @param options - Configurações opcionais
 * @param options.fallback - Rota de fallback (padrão: baseado no isStaff)
 * @param options.isStaff - Se o usuário é staff (usado para determinar fallback padrão)
 */
export function safeNavigateBack(
  navigate: NavigateFunction,
  options?: {
    fallback?: string;
    isStaff?: boolean;
  },
): void {
  const { fallback, isStaff = false } = options ?? {};

  // window.history.length > 1 indica que há histórico disponível
  // Nota: isso pode dar falso positivo em alguns browsers, mas é a melhor heurística disponível
  if (window.history.length > 1 && document.referrer) {
    navigate(-1);
  } else {
    const defaultFallback = isStaff ? "/gestao" : "/minhas-obras";
    navigate(fallback ?? defaultFallback, { replace: true });
  }
}

/**
 * Hook-friendly version que retorna uma função de callback
 */
export function createSafeBackHandler(
  navigate: NavigateFunction,
  options?: {
    fallback?: string;
    isStaff?: boolean;
  },
): () => void {
  return () => safeNavigateBack(navigate, options);
}
