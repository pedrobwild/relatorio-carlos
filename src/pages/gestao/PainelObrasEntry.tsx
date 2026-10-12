/**
 * /gestao/painel-obras — escolhe qual Painel de Obras abrir.
 *
 * - Padrão: o Painel reformulado (`pages/gestao/Obras`).
 * - `?painel=antigo`: o painel antigo, para quem ainda precisa de algo que só
 *   existe lá. O parâmetro fica na URL enquanto a pessoa navega nele.
 * - Flag `painelReformulado` desligada no banco: todo mundo volta ao painel
 *   antigo, sem publicar nada (rollback).
 */
import { lazy } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const PainelNovo = lazy(() => import("@/pages/gestao/Obras"));
const PainelAntigo = lazy(() => import("@/pages/PainelObras"));

export default function PainelObrasEntry() {
  const { isEnabled, isLoading } = useFeatureFlags();
  const [params] = useSearchParams();
  const pediuAntigo = params.get("painel") === "antigo";

  // Quem pediu o antigo não depende da flag; os demais esperam ela carregar
  // para não ver um painel e trocar para o outro.
  if (isLoading && !pediuAntigo) return null;

  const novoLigado = isEnabled("painelReformulado");
  if (!novoLigado) return <PainelAntigo />;
  if (!pediuAntigo) return <PainelNovo />;

  return (
    <>
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
        <span>Você está no painel antigo. </span>
        <Link
          to="/gestao/painel-obras"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar ao painel novo
        </Link>
      </div>
      <PainelAntigo />
    </>
  );
}
