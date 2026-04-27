import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MoreHorizontal,
  Map,
  FolderOpen,
  ClipboardSignature,
  ShoppingCart,
  Eye,
  FileText,
  Box,
  Ruler,
  DollarSign,
  Bell,
  CheckSquare,
  AlertTriangle,
  Users,
  GanttChartSquare,
  AlertCircle,
  ClipboardList,
  Boxes,
  Building2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface MoreItem {
  label: string;
  icon: typeof Map;
  to: string;
  description?: string;
}

interface MoreGroup {
  label: string;
  items: MoreItem[];
}

export function MobileMoreSheet() {
  const [open, setOpen] = useState(false);
  const { paths } = useProjectNavigation();
  const { unreadCount } = useNotifications();
  const location = useLocation();

  const groups: MoreGroup[] = [
    {
      label: "Visão Geral",
      items: [
        { label: "Jornada", icon: Map, to: paths.jornada, description: "Acompanhe cada etapa" },
        { label: "Painel da Obra", icon: Building2, to: paths.relatorio, description: "Resumo e evolução" },
      ],
    },
    {
      label: "Projeto",
      items: [
        { label: "Contrato", icon: FileText, to: paths.contrato, description: "Contrato do cliente" },
        { label: "Projeto 3D", icon: Box, to: paths.projeto3D, description: "Modelos e renders" },
        { label: "Executivo", icon: Ruler, to: paths.executivo, description: "Plantas e detalhes" },
        { label: "Documentos", icon: FolderOpen, to: paths.documentos, description: "Todos os documentos" },
      ],
    },
    {
      label: "Dia a Dia",
      items: [
        { label: "Cronograma", icon: GanttChartSquare, to: paths.cronograma, description: "Atividades e prazos" },
        { label: "Compras", icon: ShoppingCart, to: paths.compras, description: "Pedidos e cotações" },
        { label: "Estoque", icon: Boxes, to: paths.estoque, description: "Materiais, saldo e perdas" },
        { label: "Vistorias & NC", icon: Eye, to: paths.vistorias, description: "Inspeções de qualidade" },
        { label: "Não Conformidades", icon: AlertTriangle, to: paths.naoConformidades, description: "Pendências técnicas" },
        { label: "Atividades", icon: CheckSquare, to: paths.atividades, description: "Tarefas da equipe" },
        { label: "Pendências", icon: AlertCircle, to: paths.pendencias, description: "O que resolver" },
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Financeiro", icon: DollarSign, to: paths.financeiro, description: "Pagamentos e custos" },
        { label: "Formalizações", icon: ClipboardSignature, to: paths.formalizacoes, description: "Aprovações e assinaturas" },
        { label: "Dados do Cliente", icon: Users, to: paths.dadosCliente, description: "Cadastro do contratante" },
        { label: "Orçamento", icon: ClipboardList, to: paths.orcamento, description: "Detalhamento de custos" },
      ],
    },
  ];

  const allItems = groups.flatMap((g) => g.items);
  const isAnyActive = allItems.some((i) => location.pathname.startsWith(i.to));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors active:scale-[0.95]",
            isAnyActive ? "text-primary" : "text-muted-foreground"
          )}
          aria-label="Mais opções"
        >
          <span className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {isAnyActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
            )}
          </span>
          <span className="truncate">Mais</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle className="text-base font-bold">Ferramentas</SheetTitle>
        </SheetHeader>

        <nav className="space-y-4 pb-2">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-all min-h-[72px] active:scale-[0.96]",
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/20"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium leading-tight line-clamp-2",
                          isActive ? "text-primary font-semibold" : "text-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
