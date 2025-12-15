import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Clock, FileSignature, Receipt, Palette, Ruler, CheckCircle2, Calendar, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type PendingType = "decision" | "invoice" | "signature" | "approval_3d" | "approval_exec";
type PendingPriority = "alta" | "média" | "baixa";
type PendingStatus = "pendente" | "urgente" | "atrasado";

interface PendingItem {
  id: string;
  type: PendingType;
  title: string;
  description: string;
  dueDate: string;
  priority: PendingPriority;
  impact?: string;
  options?: string[];
  amount?: number;
}

// Sample data for demo
const pendingItems: PendingItem[] = [
  // Client Decisions
  {
    id: "dec-1",
    type: "decision",
    title: "Posição do suporte articulado de TV 65\"",
    description: "Definir altura e posição do suporte na parede da sala",
    dueDate: "2025-09-09",
    priority: "alta",
    impact: "Atraso na instalação elétrica embutida e possível retrabalho no gesso/pintura",
    options: ["Altura 1,10m centralizado", "Altura 1,10m deslocado 15cm esquerda", "Altura 1,20m centralizado"],
  },
  {
    id: "dec-2",
    type: "decision",
    title: "Aprovar torneira alternativa para banheiro social",
    description: "Modelo Docol Bistro Cromado (original Deca Polo indisponível até 20/09)",
    dueDate: "2025-09-10",
    priority: "média",
    impact: "Atraso de 12 dias se aguardar modelo original",
  },
  // Overdue Invoice
  {
    id: "inv-1",
    type: "invoice",
    title: "Parcela 6 - Marcenaria",
    description: "Vencimento original: 05/09/2025",
    dueDate: "2025-09-05",
    priority: "alta",
    amount: 28500,
  },
  // Upcoming Invoice
  {
    id: "inv-2",
    type: "invoice",
    title: "Parcela 7 - Instalações e acabamentos",
    description: "Próximo vencimento",
    dueDate: "2025-09-12",
    priority: "média",
    amount: 15200,
  },
  // Pending Signatures
  {
    id: "sig-1",
    type: "signature",
    title: "Aditivo de Contrato - Julho",
    description: "Inclusão de marcenaria adicional no hall de entrada",
    dueDate: "2025-09-08",
    priority: "alta",
    impact: "Pendente de assinatura para formalização do serviço adicional",
  },
  {
    id: "sig-2",
    type: "signature",
    title: "Ata de Reunião - Semana 9",
    description: "Definições sobre instalação de coifa e eletros",
    dueDate: "2025-09-10",
    priority: "baixa",
  },
  // 3D Project Approval
  {
    id: "3d-1",
    type: "approval_3d",
    title: "Aprovação do Projeto 3D - Cozinha",
    description: "Renderização final com ajustes de iluminação solicitados",
    dueDate: "2025-09-11",
    priority: "média",
    impact: "Liberação para produção de peças de marcenaria customizadas",
  },
  // Executive Project Approval
  {
    id: "exec-1",
    type: "approval_exec",
    title: "Aprovação do Projeto Executivo - Elétrica",
    description: "Planta baixa com pontos elétricos e circuitos dedicados",
    dueDate: "2025-09-07",
    priority: "alta",
    impact: "Execução da instalação elétrica já iniciada - aprovação retroativa necessária",
  },
];

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
  }
};

const getTypeColor = (type: PendingType) => {
  switch (type) {
    case "decision":
      return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "invoice":
      return "bg-rose-500/15 text-rose-600 border-rose-500/30";
    case "signature":
      return "bg-violet-500/15 text-violet-600 border-violet-500/30";
    case "approval_3d":
      return "bg-cyan-500/15 text-cyan-600 border-cyan-500/30";
    case "approval_exec":
      return "bg-indigo-500/15 text-indigo-600 border-indigo-500/30";
  }
};

const getStatus = (dueDate: string): PendingStatus => {
  const today = new Date("2025-09-08"); // Demo date
  const due = parseISO(dueDate);
  const diff = differenceInDays(due, today);
  
  if (diff < 0) return "atrasado";
  if (diff <= 2) return "urgente";
  return "pendente";
};

const getStatusBadge = (status: PendingStatus) => {
  switch (status) {
    case "atrasado":
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>;
    case "urgente":
      return <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Urgente</Badge>;
    case "pendente":
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pendente</Badge>;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string) => {
  const date = parseISO(dateStr);
  return format(date, "dd/MM", { locale: ptBR });
};

const Pendencias = () => {
  const today = new Date("2025-09-08"); // Demo date
  
  // Group and sort pending items
  const sortedItems = [...pendingItems].sort((a, b) => {
    const statusOrder = { atrasado: 0, urgente: 1, pendente: 2 };
    const statusA = getStatus(a.dueDate);
    const statusB = getStatus(b.dueDate);
    if (statusOrder[statusA] !== statusOrder[statusB]) {
      return statusOrder[statusA] - statusOrder[statusB];
    }
    return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
  });

  const overdueCount = sortedItems.filter(item => getStatus(item.dueDate) === "atrasado").length;
  const urgentCount = sortedItems.filter(item => getStatus(item.dueDate) === "urgente").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Link
              to="/relatorio"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary hover:bg-accent transition-colors"
              aria-label="Voltar ao relatório"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-muted-foreground/50">|</span>
            <h1 className="text-body font-semibold">Pendências</h1>
          </div>
        </div>
      </header>

      <main className="p-3 sm:p-4 max-w-3xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-caption text-rose-600 font-medium">Atrasados</span>
            </div>
            <p className="text-h2 font-bold text-rose-600">{overdueCount}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-caption text-amber-600 font-medium">Urgentes</span>
            </div>
            <p className="text-h2 font-bold text-amber-600">{urgentCount}</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
          <p className="text-caption text-foreground/80">
            <strong>Importante:</strong> Será acrescido 1 dia à data de entrega a cada dia sem retorno após o vencimento do prazo.
          </p>
        </div>

        {/* Pending Items List */}
        <div className="space-y-2">
          {sortedItems.map((item, index) => {
            const status = getStatus(item.dueDate);
            const daysUntil = differenceInDays(parseISO(item.dueDate), today);
            
            return (
              <div 
                key={item.id}
                className={`bg-card border rounded-lg p-3 transition-all hover:shadow-sm animate-fade-in ${
                  status === "atrasado" ? "border-rose-500/40" : 
                  status === "urgente" ? "border-amber-500/40" : "border-border"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${getTypeColor(item.type)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div>
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${getTypeColor(item.type).split(' ')[1]}`}>
                        {getTypeLabel(item.type)}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>

                {/* Content */}
                <h3 className="text-body font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-caption text-muted-foreground mb-2">{item.description}</p>

                {/* Amount for invoices */}
                {item.amount && (
                  <p className="text-h3 font-bold text-foreground mb-2">{formatCurrency(item.amount)}</p>
                )}

                {/* Options for decisions */}
                {item.options && (
                  <div className="mb-2">
                    <p className="text-tiny text-muted-foreground mb-1">Opções:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.options.map((opt, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{opt}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Impact */}
                {item.impact && (
                  <p className="text-tiny text-amber-600 bg-amber-500/10 rounded px-2 py-1 mb-2">
                    <strong>Impacto:</strong> {item.impact}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className={`text-caption font-medium ${
                      status === "atrasado" ? "text-rose-600" : 
                      status === "urgente" ? "text-amber-600" : "text-foreground"
                    }`}>
                      {formatDate(item.dueDate)}
                      {daysUntil < 0 && ` (${Math.abs(daysUntil)}d atrasado)`}
                      {daysUntil === 0 && " (hoje)"}
                      {daysUntil === 1 && " (amanhã)"}
                      {daysUntil > 1 && ` (em ${daysUntil}d)`}
                    </span>
                  </div>
                  <Link 
                    to={item.type === "invoice" ? "/financeiro" : 
                        item.type === "signature" ? "/formalizacoes" :
                        item.type === "approval_3d" ? "/projeto-3d" :
                        item.type === "approval_exec" ? "/executivo" : "/relatorio"}
                    className="flex items-center gap-1 text-caption text-primary hover:underline"
                  >
                    Ver detalhes
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {sortedItems.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-h3 font-medium text-foreground mb-1">Tudo em dia!</h3>
            <p className="text-caption text-muted-foreground">Não há pendências no momento.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Pendencias;
