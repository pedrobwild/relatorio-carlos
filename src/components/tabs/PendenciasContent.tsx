import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Clock, FileSignature, Receipt, Palette, Ruler, CheckCircle2, Calendar, ChevronRight, ShoppingCart, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePendencias, getStatus, getDaysOverdue, getDaysRemaining, PendingType, PendingStatus } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { EmptyState } from "@/components/EmptyState";

const getTypeIcon = (type: PendingType) => {
  switch (type) {
    case "decision": return <AlertTriangle className="w-4 h-4" />;
    case "invoice": return <Receipt className="w-4 h-4" />;
    case "signature": return <FileSignature className="w-4 h-4" />;
    case "approval_3d": return <Palette className="w-4 h-4" />;
    case "approval_exec": return <Ruler className="w-4 h-4" />;
    case "extra_purchase": return <ShoppingCart className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: PendingType) => {
  switch (type) {
    case "decision": return "Decisão";
    case "invoice": return "Fatura";
    case "signature": return "Assinatura";
    case "approval_3d": return "Aprovação 3D";
    case "approval_exec": return "Aprovação Executivo";
    case "extra_purchase": return "Compra Extra";
    default: return "Pendência";
  }
};

const getTypeColor = (type: PendingType) => {
  switch (type) {
    case "decision": return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "invoice": return "bg-rose-500/15 text-rose-600 border-rose-500/30";
    case "signature": return "bg-violet-500/15 text-violet-600 border-violet-500/30";
    case "approval_3d": return "bg-cyan-500/15 text-cyan-600 border-cyan-500/30";
    case "approval_exec": return "bg-indigo-500/15 text-indigo-600 border-indigo-500/30";
    case "extra_purchase": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    default: return "bg-secondary text-muted-foreground border-border";
  }
};

const getStatusBadge = (status: PendingStatus) => {
  switch (status) {
    case "atrasado": return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>;
    case "urgente": return <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Urgente</Badge>;
    case "pendente": return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pendente</Badge>;
  }
};

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDateStr = (dateStr: string) => {
  if (!dateStr) return "-";
  return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
};

const PendenciasContent = () => {
  const { projectId } = useParams();
  const { sortedItems, stats, isLoading } = usePendencias({ projectId });
  const { paths } = useProjectNavigation();
  const today = new Date();

  const getActionUrl = (item: typeof sortedItems[0]) => {
    if (item.actionUrl) return item.actionUrl;
    switch (item.type) {
      case "invoice": return paths.financeiro;
      case "signature": return paths.formalizacoes;
      case "approval_3d": return paths.projeto3D;
      case "approval_exec": return paths.executivo;
      default: return paths.relatorio;
    }
  };

  if (isLoading) {
    return <ContentSkeleton variant="list" rows={5} />;
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" /><span className="text-sm text-rose-600 font-medium">Atrasados</span></div>
            <p className="text-xl font-bold text-rose-600">{stats.overdueCount}</p>
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><span className="text-sm text-amber-600 font-medium">Urgentes</span></div>
            <p className="text-xl font-bold text-amber-600">{stats.urgentCount}</p>
          </div>
        </div>
        <div className="bg-secondary border border-border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Total</span></div>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <Alert className="border-primary/20 bg-primary/5 mb-4">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-caption text-foreground/80">
          <strong>Importante:</strong> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
        </AlertDescription>
      </Alert>

      {/* Items */}
      <div className="space-y-3">
        {sortedItems.map((item, index) => {
          const status = item.dueDate ? getStatus(item.dueDate) : "pendente";
          const daysOverdue = getDaysOverdue(item, today);
          const daysRemaining = getDaysRemaining(item, today);
          return (
            <div key={item.id}
              className={`bg-card border rounded-lg p-4 transition-all hover:shadow-md animate-fade-in ${
                status === "atrasado" ? "border-rose-500/40" : status === "urgente" ? "border-amber-500/40" : "border-border"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${getTypeColor(item.type)}`}>
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${getTypeColor(item.type).split(' ')[1]}`}>{getTypeLabel(item.type)}</span>
                      <h3 className="text-body font-medium text-foreground">{item.title}</h3>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                  <p className="text-caption text-muted-foreground mb-2">{item.description}</p>
                  {item.amount && <p className="text-h3 font-bold text-foreground mb-2">{formatCurrency(item.amount)}</p>}
                  {item.options && (
                    <div className="mb-2">
                      <p className="text-tiny text-muted-foreground mb-1">Opções:</p>
                      <div className="flex flex-wrap gap-1">
                        {item.options.map((opt, i) => <Badge key={i} variant="outline" className="text-[10px]">{opt}</Badge>)}
                      </div>
                    </div>
                  )}
                  {item.impact && (
                    <p className="text-tiny text-amber-600 bg-amber-500/10 rounded px-2 py-1 mb-2 inline-block">
                      <strong>Impacto:</strong> {item.impact}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className={`text-caption font-medium ${status === "atrasado" ? "text-rose-600" : status === "urgente" ? "text-amber-600" : "text-foreground"}`}>
                        Prazo: {formatDateStr(item.dueDate)}
                      </span>
                      {status === "atrasado" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{daysOverdue}d atrasado</Badge>}
                      {status === "urgente" && daysRemaining >= 0 && (
                        <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                          {daysRemaining === 0 ? "vence hoje" : daysRemaining === 1 ? "vence amanhã" : `${daysRemaining}d restantes`}
                        </Badge>
                      )}
                    </div>
                    <Link to={getActionUrl(item)} className="flex items-center gap-1 text-caption text-primary hover:underline font-medium">
                      Ver detalhes<ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sortedItems.length === 0 && (
          <EmptyState icon={CheckCircle2} title="Tudo em dia!" description="Não há pendências no momento." />
        )}
      </div>
    </div>
  );
};

export default PendenciasContent;
