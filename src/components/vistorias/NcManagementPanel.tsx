/**
 * NcManagementPanel — Management-first NC view.
 *
 * Layout priority:
 * 1. Compact action bar (urgent counts + create NC)
 * 2. Status tabs for quick filtering (Abertas, Em tratamento, Verificação, Encerradas)
 * 3. NC list grouped by urgency
 * 4. Collapsible analytics (dashboard) at the bottom
 */

import { useState, useMemo } from "react";
import {
  format,
  parseISO,
  differenceInDays,
  differenceInHours,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Clock, Plus, ChevronRight, User, Tag, Building2, RotateCcw, BarChart3, ChevronDown, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { NcSummaryCards } from "./NcSummaryCards";
import { NcTimelineChart } from "./NcTimelineChart";
import { NcConsolidatedReport } from "./NcConsolidatedReport";
import type {
  NonConformity,
  NcSeverity,
  NcStatus,
} from "@/hooks/useNonConformities";
import { matchesSearch } from "@/lib/searchNormalize";

// ── Status/Severity configs ──

const severityConfig: Record<
  NcSeverity,
  { label: string; className: string; order: number }
> = {
  critical: {
    label: "Crítica",
    className: "bg-red-100 text-red-700",
    order: 0,
  },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700", order: 1 },
  medium: {
    label: "Média",
    className: "bg-yellow-100 text-yellow-700",
    order: 2,
  },
  low: { label: "Baixa", className: "bg-blue-100 text-blue-700", order: 3 },
};

const statusConfig: Record<
  NcStatus,
  {
    label: string;
    shortLabel: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  open: { label: "Abertas", shortLabel: "Abertas", variant: "destructive" },
  in_treatment: {
    label: "Em tratamento",
    shortLabel: "Tratamento",
    variant: "default",
  },
  pending_verification: {
    label: "Verificação",
    shortLabel: "Verificação",
    variant: "outline",
  },
  pending_approval: {
    label: "Aprovação",
    shortLabel: "Aprovação",
    variant: "outline",
  },
  reopened: {
    label: "Reaberta",
    shortLabel: "Reaberta",
    variant: "destructive",
  },
  closed: {
    label: "Encerradas",
    shortLabel: "Encerradas",
    variant: "secondary",
  },
};

type ViewTab = "action_needed" | "all" | "closed";

interface Props {
  nonConformities: NonConformity[];
  searchQuery: string;
  onSelect: (nc: NonConformity) => void;
  onCreateNc: () => void;
  canCreate: boolean;
  showProjectBadge?: boolean;
}

export function NcManagementPanel({
  nonConformities,
  searchQuery,
  onSelect,
  onCreateNc,
  canCreate,
  showProjectBadge,
}: Props) {
  const [viewTab, setViewTab] = useState<ViewTab>("action_needed");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const effectiveSearch = searchQuery || localSearch;

  // ── Compute urgent metrics ──
  const metrics = useMemo(() => {
    const open = nonConformities.filter((nc) => nc.status !== "closed");
    const overdue = open.filter((nc) => nc.deadline && nc.deadline < today);
    const criticalHigh = open.filter(
      (nc) => nc.severity === "critical" || nc.severity === "high",
    );
    const pendingAction = nonConformities.filter(
      (nc) =>
        nc.status === "pending_verification" ||
        nc.status === "pending_approval",
    );
    const expiringSoon = open.filter((nc) => {
      if (!nc.deadline || nc.deadline < today) return false;
      const hours = differenceInHours(parseISO(nc.deadline), new Date());
      return hours <= 72;
    });
    return {
      totalOpen: open.length,
      overdue: overdue.length,
      criticalHigh: criticalHigh.length,
      pendingAction: pendingAction.length,
      expiringSoon: expiringSoon.length,
      total: nonConformities.length,
      closed: nonConformities.filter((nc) => nc.status === "closed").length,
    };
  }, [nonConformities, today]);

  // ── Filter NCs by active tab ──
  const filteredNcs = useMemo(() => {
    let result = nonConformities;

    // Tab filter
    switch (viewTab) {
      case "action_needed":
        result = result.filter((nc) => nc.status !== "closed");
        break;
      case "closed":
        result = result.filter((nc) => nc.status === "closed");
        break;
      //'all' shows everything
    }

    // Search
    if (effectiveSearch.trim()) {
      result = result.filter((nc) =>
        matchesSearch(effectiveSearch, [
          nc.title,
          nc.description,
          nc.category,
          nc.responsible_user_name,
        ]),
      );
    }

    // Sort: overdue first, then by severity, then by deadline
    return [...result].sort((a, b) => {
      const aOverdue =
        a.deadline && a.deadline < today && a.status !== "closed" ? 1 : 0;
      const bOverdue =
        b.deadline && b.deadline < today && b.status !== "closed" ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;

      const sevA = severityConfig[a.severity].order;
      const sevB = severityConfig[b.severity].order;
      if (sevA !== sevB) return sevA - sevB;

      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [nonConformities, viewTab, effectiveSearch, today]);

  if (nonConformities.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={AlertTriangle}
          title="Nenhuma não conformidade"
          description="NCs são criadas a partir de itens reprovados nas vistorias ou manualmente."
        />
        {canCreate && (
          <div className="flex justify-center">
            <Button onClick={onCreateNc} className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar NC
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── 1. Urgent Action Bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {metrics.overdue > 0 && (
          <UrgentChip
            icon={<Clock className="h-3.5 w-3.5" />}
            label={`${metrics.overdue} vencida${metrics.overdue > 1 ? "s" : ""}`}
            danger
          />
        )}
        {metrics.criticalHigh > 0 && (
          <UrgentChip
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label={`${metrics.criticalHigh} crítica${metrics.criticalHigh > 1 ? "s" : ""}/alta${metrics.criticalHigh > 1 ? "s" : ""}`}
            danger
          />
        )}
        {metrics.pendingAction > 0 && (
          <UrgentChip
            icon={<ChevronRight className="h-3.5 w-3.5" />}
            label={`${metrics.pendingAction} aguardando ação`}
          />
        )}
        {metrics.expiringSoon > 0 && (
          <UrgentChip
            icon={<Clock className="h-3.5 w-3.5" />}
            label={`${metrics.expiringSoon} vence em 72h`}
            warning
          />
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <Search className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button
              onClick={onCreateNc}
              size="sm"
              className="gap-1.5 h-9 shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova NC</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile search */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden md:hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar NC..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9 h-10"
                autoFocus
              />
              {localSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setLocalSearch("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. View tabs ── */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <TabButton
          active={viewTab === "action_needed"}
          onClick={() => setViewTab("action_needed")}
          count={metrics.totalOpen}
          danger={metrics.overdue > 0}
        >
          Pendentes
        </TabButton>
        <TabButton
          active={viewTab === "all"}
          onClick={() => setViewTab("all")}
          count={metrics.total}
        >
          Todas
        </TabButton>
        <TabButton
          active={viewTab === "closed"}
          onClick={() => setViewTab("closed")}
          count={metrics.closed}
        >
          Encerradas
        </TabButton>
      </div>

      {/* ── 3. NC List ── */}
      {filteredNcs.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={
            viewTab === "closed"
              ? "Nenhuma NC encerrada"
              : "Nenhuma NC pendente"
          }
          description={
            effectiveSearch
              ? "Nenhuma NC corresponde à busca."
              : "Todas as NCs foram resolvidas! 🎉"
          }
        />
      ) : (
        <div
          className="space-y-2"
          role="list"
          aria-label="Lista de não conformidades"
        >
          {filteredNcs.map((nc) => (
            <NcRow
              key={nc.id}
              nc={nc}
              today={today}
              onSelect={onSelect}
              showProjectBadge={showProjectBadge}
            />
          ))}
        </div>
      )}

      {/* ── 4. Collapsible Analytics ── */}
      <Collapsible open={showAnalytics} onOpenChange={setShowAnalytics}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full gap-2 h-10 text-sm text-muted-foreground justify-center"
          >
            <BarChart3 className="h-4 w-4" />
            {showAnalytics ? "Ocultar Dashboard" : "Ver Dashboard e Relatório"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAnalytics ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <NcSummaryCards
            nonConformities={nonConformities}
            activeFilter={null}
            onFilterChange={() => {}}
          />
          <NcTimelineChart nonConformities={nonConformities} />
          <NcConsolidatedReport nonConformities={nonConformities} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Sub-components ──

function UrgentChip({
  icon,
  label,
  danger,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${
        danger
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : warning
            ? "bg-orange-100 text-orange-700 border border-orange-200"
            : "bg-primary/10 text-primary border border-primary/20"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  count,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[40px] ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      <Badge
        variant={active && danger ? "destructive" : "secondary"}
        className="text-[10px] h-5 min-w-[20px] justify-center"
      >
        {count}
      </Badge>
    </button>
  );
}

function NcRow({
  nc,
  today,
  onSelect,
  showProjectBadge,
}: {
  nc: NonConformity & { project_name?: string | null };
  today: string;
  onSelect: (nc: NonConformity) => void;
  showProjectBadge?: boolean;
}) {
  const sev = severityConfig[nc.severity];
  const st = statusConfig[nc.status];
  const isOverdue =
    nc.deadline && nc.deadline < today && nc.status !== "closed";
  const reopenCount = nc.reopen_count ?? 0;

  const deadlineDate = nc.deadline ? parseISO(nc.deadline) : null;
  const daysLeft =
    deadlineDate && nc.status !== "closed"
      ? differenceInDays(deadlineDate, new Date())
      : null;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;

  // Deadline display
  let deadlineDisplay: React.ReactNode = null;
  if (nc.deadline) {
    const formattedDate = format(deadlineDate!, "dd/MM/yyyy", { locale: ptBR });
    if (nc.status === "closed") {
      deadlineDisplay = (
        <span className="text-muted-foreground text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Prazo: {formattedDate}
        </span>
      );
    } else if (isOverdue) {
      const daysOverdue = Math.abs(differenceInDays(new Date(), deadlineDate!));
      deadlineDisplay = (
        <span className="text-destructive font-medium text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {daysOverdue}d atrasada · {formattedDate}
        </span>
      );
    } else if (isExpiringSoon) {
      deadlineDisplay = (
        <span className="text-orange-600 font-medium text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {daysLeft === 0 ? "Vence hoje" : `${daysLeft}d`} · {formattedDate}
        </span>
      );
    } else {
      deadlineDisplay = (
        <span className="text-muted-foreground text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formattedDate}
        </span>
      );
    }
  }

  return (
    <Card
      role="listitem"
      className={`cursor-pointer transition-all active:scale-[0.98] hover:border-primary/40 ${
        isOverdue ? "border-destructive/40 bg-destructive/[0.02]" : ""
      } ${isExpiringSoon && !isOverdue ? "border-orange-300/60" : ""}`}
      onClick={() => onSelect(nc)}
    >
      <CardContent className="p-3">
        {/* Row 1: severity indicator + title + deadline */}
        <div className="flex items-start gap-2.5">
          {/* Severity dot */}
          <div
            className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
              nc.severity === "critical"
                ? "bg-red-500"
                : nc.severity === "high"
                  ? "bg-orange-500"
                  : nc.severity === "medium"
                    ? "bg-yellow-500"
                    : "bg-blue-400"
            }`}
            aria-label={`Severidade: ${sev.label}`}
          />

          <div className="flex-1 min-w-0">
            {/* Project badge */}
            {showProjectBadge && (nc as any).project_name && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-md mb-1 inline-flex items-center gap-1 w-fit">
                <Building2 className="h-2.5 w-2.5" />
                {(nc as any).project_name}
              </span>
            )}
            {/* Title + arrow */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm leading-snug line-clamp-2">
                {nc.title}
              </p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>

            {/* Row 2: status + severity + category + deadline */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant={st.variant} className="text-[10px] h-5">
                {st.shortLabel}
              </Badge>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sev.className}`}
              >
                {sev.label}
              </span>
              {nc.category && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Tag className="h-2.5 w-2.5" />
                  {nc.category}
                </span>
              )}
              {reopenCount > 0 && (
                <Badge
                  variant={reopenCount >= 3 ? "destructive" : "outline"}
                  className="text-[10px] h-5 gap-0.5"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  {reopenCount}x
                </Badge>
              )}
            </div>

            {/* Row 3: responsible + deadline */}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-3 min-w-0">
                {nc.responsible_user_name && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <User className="h-3 w-3 shrink-0" />
                    {nc.responsible_user_name}
                  </span>
                )}
              </div>
              {deadlineDisplay}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
