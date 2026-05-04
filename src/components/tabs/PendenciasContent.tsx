import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  FileSignature,
  Receipt,
  Palette,
  Ruler,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ShoppingCart,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  usePendencias,
  getStatus,
  getDaysOverdue,
  getDaysRemaining,
  PendingType,
  PendingStatus,
} from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { ContentSkeleton } from "@/components/ContentSkeleton";
import { EmptyState } from "@/components/EmptyState";

const getTypeIcon = (type: PendingType) => {
  switch (type) {
    case "decision":
      return <AlertTriangle className="w-4 h-4" />;
    case "invoice":
      return <Receipt className="w-4 h-4" />;
    case "signature":
      return <FileSignature className="w-4 h-4" />;
    case "approval_3d":
      return <Palette className="w-4 h-4" />;
    case "approval_exec":
      return <Ruler className="w-4 h-4" />;
    case "extra_purchase":
      return <ShoppingCart className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: PendingType) => {
  switch (type) {
    case "decision":
      return "Decisão";
    case "invoice":
      return "Fatura";
    case "signature":
      return "Assinatura";
    case "approval_3d":
      return "Aprovação 3D";
    case "approval_exec":
      return "Aprovação Executivo";
    case "extra_purchase":
      return "Compra Extra";
    default:
      return "Pendência";
  }
};

const getTypeColor = (type: PendingType) => {
  switch (type) {
    case "decision":
      return "bg-warning/15 text-[hsl(var(--warning))] border-warning/30";
    case "invoice":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "signature":
      return "bg-primary/15 text-primary border-primary/30";
    case "approval_3d":
      return "bg-info/15 text-[hsl(var(--info))] border-info/30";
    case "approval_exec":
      return "bg-accent text-accent-foreground border-accent/30";
    case "extra_purchase":
      return "bg-success/15 text-[hsl(var(--success))] border-success/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
};

const getStatusBadge = (status: PendingStatus) => {
  switch (status) {
    case "atrasado":
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Atrasado
        </Badge>
      );
    case "urgente":
      return (
        <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-[10px] px-1.5 py-0">
          Urgente
        </Badge>
      );
    case "pendente":
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Pendente
        </Badge>
      );
  }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const formatDateStr = (dateStr: string) => {
  if (!dateStr) return "-";
  return format(parseISO(dateStr), "dd/MM", { locale: ptBR });
};

const PendenciasContent = () => {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sortedItems, stats, isLoading } = usePendencias({ projectId });
  const { paths } = useProjectNavigation();
  const today = new Date();

  const showCriticalOnly = searchParams.get("filtro") === "criticas";

  const displayItems = showCriticalOnly
    ? sortedItems.filter((item) => {
        const status = item.dueDate ? getStatus(item.dueDate) : "pendente";
        return status === "atrasado" || status === "urgente";
      })
    : sortedItems;

  const getActionUrl = (item: (typeof sortedItems)[0]) => {
    if (item.actionUrl) return item.actionUrl;
    switch (item.type) {
      case "invoice":
        return paths.financeiro;
      case "signature":
        return paths.formalizacoes;
      case "approval_3d":
        return paths.projeto3D;
      case "approval_exec":
        return paths.executivo;
      default:
        return paths.relatorio;
    }
  };

  if (isLoading) {
    return <ContentSkeleton variant="list" rows={5} />;
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-xs sm:text-sm text-destructive font-medium">
              Atrasados
            </span>
          </div>
          <p className="text-2xl font-bold text-destructive tabular-nums">
            {stats.overdueCount}
          </p>
        </div>
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[hsl(var(--warning))] shrink-0" />
            <span className="text-xs sm:text-sm text-[hsl(var(--warning))] font-medium">
              Urgentes
            </span>
          </div>
          <p className="text-2xl font-bold text-[hsl(var(--warning))] tabular-nums">
            {stats.urgentCount}
          </p>
        </div>
        <div className="bg-secondary border border-border rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
        </div>
      </div>

      {/* Info Banner */}
      <Alert className="border-primary/20 bg-primary/5 mb-4">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-caption text-foreground/80">
          <strong>Importante:</strong> Será acrescido 1 dia à data de entrega a
          cada dia sem retorno após o vencimento do prazo.
        </AlertDescription>
      </Alert>

      {/* Filter toggle */}
      {showCriticalOnly && (
        <div className="flex items-center justify-between mb-4 px-1">
          <Badge variant="destructive" className="text-xs gap-1">
            <AlertTriangle className="w-3 h-3" />
            Mostrando apenas críticas ({displayItems.length})
          </Badge>
          <button
            onClick={() => setSearchParams({})}
            className="text-xs text-primary hover:underline font-medium"
          >
            Ver todas
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {displayItems.map((item, index) => {
          const status = item.dueDate ? getStatus(item.dueDate) : "pendente";
          const daysOverdue = getDaysOverdue(item, today);
          const daysRemaining = getDaysRemaining(item, today);
          return (
            <div
              key={item.id}
              className={`bg-card border rounded-xl p-4 transition-all hover:shadow-md animate-fade-in ${
                status === "atrasado"
                  ? "border-destructive/40"
                  : status === "urgente"
                    ? "border-warning/40"
                    : "border-border"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${getTypeColor(item.type)}`}
                >
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span
                        className={`text-[10px] font-medium uppercase tracking-wide ${getTypeColor(item.type).split(" ")[1]}`}
                      >
                        {getTypeLabel(item.type)}
                      </span>
                      <h3 className="text-body font-medium text-foreground">
                        {item.title}
                      </h3>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                  <p className="text-caption text-muted-foreground mb-2">
                    {item.description}
                  </p>
                  {item.amount && (
                    <p className="text-h3 font-bold text-foreground mb-2">
                      {formatCurrency(item.amount)}
                    </p>
                  )}
                  {item.options && (
                    <div className="mb-2">
                      <p className="text-tiny text-muted-foreground mb-1">
                        Opções:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.options.map((opt, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.impact && (
                    <p className="text-tiny text-[hsl(var(--warning))] bg-warning/10 rounded px-2 py-1 mb-2 inline-block">
                      <strong>Impacto:</strong> {item.impact}
                    </p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-border mt-3 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span
                        className={`text-caption font-medium ${status === "atrasado" ? "text-destructive" : status === "urgente" ? "text-[hsl(var(--warning))]" : "text-foreground"}`}
                      >
                        Prazo: {formatDateStr(item.dueDate)}
                      </span>
                      {status === "atrasado" && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {daysOverdue}d atrasado
                        </Badge>
                      )}
                      {status === "urgente" && daysRemaining >= 0 && (
                        <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-[10px] px-1.5 py-0">
                          {daysRemaining === 0
                            ? "vence hoje"
                            : daysRemaining === 1
                              ? "vence amanhã"
                              : `${daysRemaining}d restantes`}
                        </Badge>
                      )}
                    </div>
                    <Link
                      to={getActionUrl(item)}
                      className="flex items-center gap-1 text-caption text-primary hover:underline font-medium min-h-[44px] sm:min-h-0 shrink-0"
                    >
                      Ver detalhes
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {displayItems.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title={
              showCriticalOnly ? "Nenhuma pendência crítica" : "Tudo em dia!"
            }
            description={
              showCriticalOnly
                ? "Não há itens atrasados ou urgentes no momento."
                : "Não há pendências no momento. Quando surgir algo que precise da sua atenção, aparecerá aqui."
            }
            hint={
              showCriticalOnly
                ? undefined
                : "Pendências incluem aprovações, pagamentos e decisões que dependem de você."
            }
            action={
              showCriticalOnly
                ? {
                    label: "Ver todas as pendências",
                    onClick: () => setSearchParams({}),
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};

export default PendenciasContent;
