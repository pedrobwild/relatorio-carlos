import { useEffect } from "react";
import { toast } from "sonner";

// Detecta quando o navegador "descarta" a aba (Memory Saver / baixa memória)
// e recarrega a página ao voltar. Isso NÃO é um refresh disparado pelo app.
export function TabDiscardDetector() {
  useEffect(() => {
    const wasDiscarded =
      typeof document !== "undefined" &&
      // `wasDiscarded` é específico do Chromium
      Boolean((document as unknown as { wasDiscarded?: boolean }).wasDiscarded);

    if (wasDiscarded) {
      toast.message("A página foi recarregada pelo navegador", {
        description:
          'Isso geralmente acontece por "Economia de memória". Se estiver atrapalhando, desative para este site no seu navegador.',
        duration: 9000,
      });
    }
  }, []);

  return null;
}
