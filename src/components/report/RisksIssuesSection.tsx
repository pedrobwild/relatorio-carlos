import { RiskIssue } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, AlertCircle, Clock, User, ChevronRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
      {/* Top 3 Highlight */}
      {top3.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-foreground">Top 3 Pontos de Atenção</span>
          </div>
          <div className="space-y-2">
            {top3.map((issue, index) => (
              <div key={issue.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {getTypeBadge(issue.type)}
                    {getSeverityBadge(issue.severity)}
                    {getStatusBadge(issue.status)}
                  </div>
                  <p className="text-sm font-medium text-foreground">{issue.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{issue.actionPlan}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Riscos, Impedimentos e Plano de Ação</h3>
          </div>
        </div>
        
        <div className="divide-y divide-border">
          {issues.map((issue) => (
            <Dialog key={issue.id}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto p-4 rounded-none hover:bg-secondary/50"
                >
                  <div className="flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getTypeBadge(issue.type)}
                      {getSeverityBadge(issue.severity)}
                    </div>
                    <p className="text-sm font-medium text-foreground">{issue.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {issue.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(issue.dueDate), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold">{issue.title}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {getTypeBadge(issue.type)}
                    {getSeverityBadge(issue.severity)}
                    {getStatusBadge(issue.status)}
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descrição</p>
                    <p className="text-sm text-foreground">{issue.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Impacto Prazo</p>
                      <Badge variant="outline" className="text-xs capitalize">{issue.impact.time}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Impacto Custo</p>
                      <Badge variant="outline" className="text-xs capitalize">{issue.impact.cost}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Impacto Qualidade</p>
                      <Badge variant="outline" className="text-xs capitalize">{issue.impact.quality}</Badge>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plano de Ação</p>
                    <p className="text-sm text-foreground">{issue.actionPlan}</p>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Responsável: </span>
                      <span className="font-medium text-foreground">{issue.owner}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prazo: </span>
                      <span className="font-medium text-foreground">
                        {format(new Date(issue.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RisksIssuesSection;
