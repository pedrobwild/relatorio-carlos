/**
 * CsAnalytics — visão executiva e analítica de Customer Success.
 *
 * Apresenta exclusivamente o dashboard agregado de tickets:
 *   - KPIs (totais, abertos, em andamento, concluídos, críticos)
 *   - Matriz Status × Severidade (heatmap clicável)
 *   - Listas de prioridade (críticos, antigos, parados)
 *
 * Para a operação (CRUD/lista filtrável), ver `CsOperacional`.
 */
import { useNavigate } from "react-router-dom";
import { ListChecks } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { PageHeader, PageSkeleton } from "@/components/ui-premium";

import {
  useCsTickets,
  type CsTicketSeverity,
  type CsTicketStatus,
} from "@/hooks/useCsTickets";
import { CsDashboard } from "@/components/cs/CsDashboard";

export default function CsAnalytics() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useCsTickets();

  /**
   * Quando um filtro é selecionado no dashboard, levamos o usuário ao módulo
   * operacional já com o estado pré-preenchido via querystring (status/severity).
   */
  const handleFilter = ({
    status,
    severity,
  }: {
    status?: CsTicketStatus | null;
    severity?: CsTicketSeverity | null;
  }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    const qs = params.toString();
    navigate(`/gestao/cs/operacional${qs ? `?${qs}` : ""}`);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Customer Success"
        title="Analytics"
        description="Visão executiva dos tickets de Customer Success por obra: severidade, status, gargalos e tickets parados."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/gestao/cs/operacional")}
          >
            <ListChecks className="h-4 w-4 mr-1.5" />
            Ir para operacional
          </Button>
        }
      />

      <div className="pt-6">
        {isLoading ? (
          <PageSkeleton metrics content="cards" />
        ) : (
          <CsDashboard tickets={tickets} onFilter={handleFilter} />
        )}
      </div>
    </PageContainer>
  );
}
