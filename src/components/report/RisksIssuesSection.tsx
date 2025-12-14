import { RiskIssue } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RisksIssuesSectionProps {
  issues: RiskIssue[];
}

const getTypeBadge = (type: RiskIssue["type"]) => {
  switch (type) {
    case "risco":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">Risco</Badge>;
    case "impedimento":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Impedimento</Badge>;
    case "problema":
      return <Badge variant="outline" className="bg-info/10 text-info border-info/20 text-xs">Problema</Badge>;
  }
};

const getSeverityBadge = (severity: RiskIssue["severity"]) => {
  switch (severity) {
    case "baixa":
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Baixa</Badge>;
    case "média":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">Média</Badge>;
    case "alta":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Alta</Badge>;
    case "crítica":
      return <Badge variant="destructive" className="text-xs">Crítica</Badge>;
  }
};

const getStatusBadge = (status: RiskIssue["status"]) => {
  switch (status) {
    case "aberto":
      return <Badge variant="outline" className="text-xs">Aberto</Badge>;
    case "em acompanhamento":
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">Em acompanhamento</Badge>;
    case "ação imediata":
      return <Badge variant="destructive" className="text-xs">Ação imediata</Badge>;
    case "resolvido":
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Resolvido</Badge>;
  }
};

const RisksIssuesSection = ({ issues }: RisksIssuesSectionProps) => {
  // Get top 3 by severity
  const top3 = issues
    .filter(i => i.status !== "resolvido")
    .sort((a, b) => {
      const severityOrder = { crítica: 0, alta: 1, média: 2, baixa: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Full Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 sm:p-5 border-b border-border">
          <h3 className="text-sm sm:text-base font-semibold text-foreground">Gestão de Riscos</h3>
        </div>
        
        <div className="divide-y divide-border">
          {issues.map((issue) => (
            <div key={issue.id} className="p-4 sm:p-5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{issue.title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 mt-1.5 ml-5.5">
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {format(new Date(issue.dueDate), "dd/MM", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Show action plan directly with numbered lines */}
            <div className="bg-secondary rounded-lg p-2.5 sm:p-3">
              <p className="text-xs font-bold text-foreground mb-1">Plano de Ação</p>
              <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed space-y-1">
                {issue.actionPlan.split('\n').map((line, idx) => (
                  <p key={idx}>{idx + 1}) {line.trim()}</p>
                ))}
              </div>
            </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RisksIssuesSection;
