import { useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * VitrineEntry — /vitrine/:projectId
 * Entrada dedicada da LP da placa de obra (bewild.com.br/o).
 * Marca a sessão como "vitrine" (pra ativar o CTA comercial no portal) e
 * encaminha pro MESMO login demo já usado nos orçamentos, caindo na obra.
 * Não altera o fluxo do demo/orçamento: o CTA só aparece quando esta flag
 * de sessão está setada, o que só acontece por esta rota.
 */
const DEMO_EMAIL = "pedro.demo@bwild.com.br";
const DEMO_PASSWORD = "512451";

export default function VitrineEntry() {
  const { projectId } = useParams<{ projectId: string }>();

  useEffect(() => {
    try {
      sessionStorage.setItem("bw_vitrine_cta", "1");
      sessionStorage.removeItem("bw_vitrine_cta_dismissed");
    } catch {
      // ignore storage errors
    }
    const id = projectId ?? "";
    const redirect = encodeURIComponent(`/obra/${id}`);
    const url = `/auth?email=${encodeURIComponent(DEMO_EMAIL)}&password=${encodeURIComponent(DEMO_PASSWORD)}&redirect=${redirect}`;
    window.location.replace(url);
  }, [projectId]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Abrindo o portal…</p>
      </div>
    </div>
  );
}
