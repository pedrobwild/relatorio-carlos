import { useMemo, useState } from "react";
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
  CheckSquare,
  AlertTriangle,
  Users,
  GanttChartSquare,
  AlertCircle,
  ClipboardList,
  Building2,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { matchesSearch } from "@/lib/searchNormalize";
import { cn } from "@/lib/utils";

interface MoreItem {
  label: string;
  icon: LucideIcon;
  to: string;
  description?: string;
}

interface MoreGroup {
  label: string;
  items: MoreItem[];
}

interface MobileMoreSheetProps {
  /** Sum of pending counts in sections not visible in the main bar. */
  badgeCount?: number;
}

export function MobileMoreSheet({ badgeCount = 0 }: MobileMoreSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { paths } = useProjectNavigation();
  const location = useLocation();

  const groups = useMemo<MoreGroup[]>(
    () => [
      {
        label: "Visão Geral",
        items: [
          { label: "Jornada", icon: Map, to: paths.jornada, description: "Acompanhe cada etapa" },
          { label: "Painel", icon: Building2, to: paths.relatorio, description: "Resumo e evolução" },
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
          { label: "Vistorias", icon: Eye, to: paths.vistorias, description: "Inspeções de qualidade" },
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
    ],
    [paths],
  );

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const isAnyActive = allItems.some((i) => location.pathname.startsWith(i.to));

  // Filtered groups (search is full-text on label + description)
  const filteredGroups = useMemo<MoreGroup[]>(() => {
    if (!query.trim()) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => matchesSearch(query, [item.label, item.description])),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const handleClose = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5",
            "min-h-[56px] transition-all active:scale-[0.94]",
            "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
            isAnyActive ? "text-primary" : "text-foreground-muted",
          )}
          aria-label={
            badgeCount > 0
              ? `Mais opções — ${badgeCount} pendências em outras seções`
              : "Mais opções"
          }
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span
            className={cn(
              "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
              isAnyActive ? "bg-primary/12" : "bg-transparent",
            )}
          >
            <MoreHorizontal
              className={cn(
                "h-[22px] w-[22px] transition-colors",
                isAnyActive ? "text-primary" : "text-foreground-muted",
              )}
              strokeWidth={isAnyActive ? 2.25 : 2}
            />
            {badgeCount > 0 ? (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                aria-hidden="true"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : (
              isAnyActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
              )
            )}
          </span>
          <span
            className={cn(
              "text-[11px] leading-none truncate max-w-full",
              isAnyActive ? "font-semibold text-primary" : "font-medium",
            )}
          >
            Mais
          </span>
          {/* Live region: announce badge changes for screen readers */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {badgeCount > 0
              ? `${badgeCount} pendências em outras seções`
              : ""}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-safe max-h-[88dvh] flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-4 pb-3 shrink-0 text-left">
          <SheetTitle className="text-base font-bold">Ferramentas da obra</SheetTitle>
        </SheetHeader>

        {/* Sticky search */}
        <div className="px-5 pb-3 shrink-0 border-b border-border-subtle">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ferramenta…"
              className="pl-9 h-11"
              autoFocus={false}
              aria-label="Buscar ferramenta"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-5">
          {filteredGroups.length === 0 && (
            <div className="px-2 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Nada encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente buscar por outro termo.
              </p>
            </div>
          )}
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={handleClose}
                      className={cn(
                        "flex items-start gap-2.5 px-3 py-3 rounded-2xl text-left transition-all",
                        "min-h-[64px] active:scale-[0.97]",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        isActive
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : "bg-muted/40 hover:bg-muted/60 active:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-card text-foreground-muted shadow-sm",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="flex-1 min-w-0 pt-0.5">
                        <span
                          className={cn(
                            "block text-[13px] font-semibold leading-tight truncate",
                            isActive ? "text-primary" : "text-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                            {item.description}
                          </span>
                        )}
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
