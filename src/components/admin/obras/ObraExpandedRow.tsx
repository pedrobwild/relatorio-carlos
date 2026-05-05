import { useProjectDashboardSummary } from "@/hooks/useOptimizedQueries";
import {
  Loader2,
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ObraExpandedRowProps {
  projectId: string;
  contractValue: number | null;
}

export function ObraExpandedRow({
  projectId,
  contractValue,
}: ObraExpandedRowProps) {
  const { data: summary, isLoading } = useProjectDashboardSummary(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Carregando resumo…
        </span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-3 px-4 text-sm text-muted-foreground italic">
        Resumo não disponível para este projeto.
      </div>
    );
  }

  const pendingCount = summary.pending_count ?? 0;
  const overdueCount = summary.overdue_count ?? 0;
  const documentsCount = summary.documents_count ?? 0;
  const pendingDocsCount = summary.pending_documents_count ?? 0;
  const pendingSignatures = summary.pending_signatures_count ?? 0;
  const paidAmount = summary.paid_amount ?? 0;
  const _totalPayments = summary.total_payments ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 px-4 bg-muted/30 rounded-md">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`h-4 w-4 ${overdueCount > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground"}`}
        />
        <div>
          <p className="text-xs text-muted-foreground">Pendências</p>
          <p className="text-sm font-medium">
            {pendingCount > 0 ? (
              <span className="flex items-center gap-1">
                {pendingCount}
                {overdueCount > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/20 text-xs px-1.5 py-0"
                  >
                    {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </span>
            ) : (
              <span className="text-[hsl(var(--success))]">Em dia</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Documentos</p>
          <p className="text-sm font-medium">
            {documentsCount}
            {pendingDocsCount > 0 && (
              <span className="text-[hsl(var(--warning))] ml-1">
                ({pendingDocsCount} pend.)
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TrendingUp
          className={`h-4 w-4 ${pendingSignatures > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground"}`}
        />
        <div>
          <p className="text-xs text-muted-foreground">Assinaturas</p>
          <p className="text-sm font-medium">
            {pendingSignatures > 0 ? (
              <Badge
                variant="outline"
                className="bg-warning/10 text-[hsl(var(--warning))] border-warning/20 text-xs px-1.5 py-0"
              >
                {pendingSignatures} pendente{pendingSignatures > 1 ? "s" : ""}
              </Badge>
            ) : (
              "OK"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Financeiro</p>
          <p className="text-sm font-medium">
            {contractValue
              ? `R$ ${paidAmount.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} / ${contractValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
