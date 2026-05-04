import { useMemo } from "react";
import {
  Ban,
  ClipboardX,
  CalendarX,
  Clock,
  HeartPulse,
  ChevronRight,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

// ─── Types ───────────────────────────────────────────────────────────────────

type Urgency = "critical" | "high" | "medium";

interface ActionItem {
  id: string;
  projectName: string;
  projectId: string;
  reason: string;
  responsible: string | null;
  urgency: Urgency;
  deadline: string | null;
  icon: React.ReactNode;
  cta: string;
}

interface PortfolioActionInboxProps {
  projects: ProjectWithCustomer[];
  summaries: ProjectSummary[];
  onNavigate?: (projectId: string) => void;
}

// ─── Urgency styles ──────────────────────────────────────────────────────────

const urgencyConfig: Record<
  Urgency,
  { badge: string; dot: string; iconBg: string }
> = {
  critical: {
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
    iconBg: "bg-destructive/10 text-destructive",
  },
  high: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dot: "bg-amber-500",
    iconBg: "bg-amber-500/10 text-amber-600",
  },
  medium: {
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    dot: "bg-blue-500",
    iconBg: "bg-blue-500/10 text-blue-600",
  },
};

// ─── Build action items from real data ───────────────────────────────────────

function buildActionItems(
  projects: ProjectWithCustomer[],
  summaries: ProjectSummary[],
): ActionItem[] {
  const summaryMap = new Map<string, ProjectSummary>();
  for (const s of summaries) summaryMap.set(s.id, s);

  const now = Date.now();
  const MS_STALE = 7 * 24 * 60 * 60 * 1000;
  const items: ActionItem[] = [];

  for (const p of projects) {
    const s = summaryMap.get(p.id);

    if (p.planned_end_date && p.status === "active" && !p.actual_end_date) {
      const diff = new Date(p.planned_end_date).getTime() - now;
      if (diff < 0) {
        const daysOverdue = Math.ceil(Math.abs(diff) / (1000 * 60 * 60 * 24));
        items.push({
          id: `overdue-${p.id}`,
          projectName: p.name,
          projectId: p.id,
          reason:
            daysOverdue === 1
              ? "Entrega venceu ontem"
              : `Entrega vencida há ${daysOverdue} dias`,
          responsible: p.engineer_name ?? null,
          urgency: "critical",
          deadline: `${daysOverdue}d`,
          icon: <CalendarX className="h-3.5 w-3.5" />,
          cta: "Ver",
        });
      }
    }

    if (p.status === "paused") {
      items.push({
        id: `blocked-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason: "Obra pausada",
        responsible: p.engineer_name ?? null,
        urgency: "critical",
        deadline: null,
        icon: <Ban className="h-3.5 w-3.5" />,
        cta: "Ver",
      });
    }

    if (p.planned_end_date && p.status === "active" && !p.actual_end_date) {
      const diff = new Date(p.planned_end_date).getTime() - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 14) {
        items.push({
          id: `approaching-${p.id}`,
          projectName: p.name,
          projectId: p.id,
          reason:
            days === 0
              ? "Entrega prevista para hoje!"
              : days === 1
                ? "Entrega amanhã"
                : `Faltam ${days} dias para entrega`,
          responsible: p.engineer_name ?? null,
          urgency: days <= 3 ? "critical" : days <= 7 ? "high" : "medium",
          deadline: `${days}d`,
          icon: <Clock className="h-3.5 w-3.5" />,
          cta: "Ver",
        });
      }
    }

    if (p.status === "active") {
      const ref = s?.last_activity_at ?? p.created_at;
      const refTime = ref ? new Date(ref).getTime() : 0;
      const staleDays = refTime
        ? Math.floor((now - refTime) / (1000 * 60 * 60 * 24))
        : null;
      if (refTime && now - refTime > MS_STALE) {
        items.push({
          id: `stale-${p.id}`,
          projectName: p.name,
          projectId: `stale-${p.id}`,
          reason: `Parada há ${staleDays} dias — verifique se há bloqueio`,
          responsible: p.engineer_name ?? null,
          urgency: (staleDays ?? 8) >= 14 ? "high" : "medium",
          deadline: null,
          icon: <ClipboardX className="h-3.5 w-3.5" />,
          cta: "Ver",
        });
      }
    }

    if (s && p.status === "active" && s.overdue_count > 0) {
      items.push({
        id: `health-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason:
          s.overdue_count === 1
            ? "1 pendência vencida — ação imediata necessária"
            : `${s.overdue_count} pendências vencidas — priorize resolução`,
        responsible: p.engineer_name ?? null,
        urgency: "critical",
        deadline: null,
        icon: <HeartPulse className="h-3.5 w-3.5" />,
        cta: "Ver",
      });
    }
  }

  const urgencyOrder: Record<Urgency, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return items;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioActionInbox({
  projects,
  summaries,
  onNavigate,
}: PortfolioActionInboxProps) {
  const items = useMemo(
    () => buildActionItems(projects, summaries),
    [projects, summaries],
  );

  const displayed = items.slice(0, 6);
  const remaining = items.length - displayed.length;

  return (
    <div
      className="rounded-xl border border-border/40 bg-card overflow-hidden"
      role="region"
      aria-label="Ações prioritárias"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <Inbox
            className="h-3 w-3 text-muted-foreground/60"
            aria-hidden="true"
          />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Ações
          </h3>
          {items.length > 0 && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[9px] font-bold tabular-nums bg-muted"
            >
              {items.length}
            </Badge>
          )}
        </div>
        {remaining > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] text-primary gap-0.5 px-1.5"
          >
            +{remaining} <ChevronRight className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>

      {/* Items */}
      {displayed.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-xs font-medium text-emerald-600">✓ Tudo em dia</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Nenhuma ação urgente
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/15">
          {displayed.map((item) => {
            const cfg = urgencyConfig[item.urgency];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center gap-2 w-full text-left px-3 py-2",
                    "hover:bg-muted/20 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  )}
                  onClick={() => onNavigate?.(item.projectId)}
                  aria-label={`${item.projectName}: ${item.reason}`}
                >
                  {/* Icon */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "flex items-center justify-center h-6 w-6 rounded-md",
                        cfg.iconBg,
                      )}
                    >
                      {item.icon}
                    </div>
                    {item.urgency === "critical" && (
                      <div
                        className={cn(
                          "absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-card",
                          cfg.dot,
                          "animate-pulse",
                        )}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                      {item.projectName}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-tight truncate">
                      {item.reason}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
