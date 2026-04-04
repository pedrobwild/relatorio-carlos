import { useMemo } from 'react';
import {
  Ban, ClipboardX, Milestone, CalendarX, Clock,
  HeartPulse, ChevronRight, ArrowRight, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

// ─── Types ───────────────────────────────────────────────────────────────────

type Urgency = 'critical' | 'high' | 'medium';

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

const urgencyConfig: Record<Urgency, { badge: string; dot: string; label: string; iconBg: string }> = {
  critical: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    dot: 'bg-destructive',
    label: 'Crítico',
    iconBg: 'bg-destructive/10 text-destructive',
  },
  high: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Alto',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  medium: {
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dot: 'bg-blue-500',
    label: 'Médio',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
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
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const items: ActionItem[] = [];

  for (const p of projects) {
    const s = summaryMap.get(p.id);

    if (s && s.unsigned_formalizations > 0) {
      items.push({
        id: `sign-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason: `${s.unsigned_formalizations} assinatura(s) pendente(s)`,
        responsible: p.engineer_name ?? null,
        urgency: 'critical',
        deadline: 'Hoje',
        icon: <FileSignature className="h-4 w-4" />,
        cta: 'Assinar',
      });
    }

    if (p.status === 'paused') {
      items.push({
        id: `blocked-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason: 'Obra bloqueada / pausada',
        responsible: p.engineer_name ?? null,
        urgency: 'critical',
        deadline: null,
        icon: <Ban className="h-4 w-4" />,
        cta: 'Resolver',
      });
    }

    if (s && s.pending_documents > 0) {
      items.push({
        id: `docs-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason: `${s.pending_documents} documento(s) pendente(s)`,
        responsible: p.engineer_name ?? null,
        urgency: 'high',
        deadline: null,
        icon: <FileX className="h-4 w-4" />,
        cta: 'Enviar',
      });
    }

    if (p.status === 'active') {
      const ref = s?.last_activity_at ?? p.created_at;
      const refTime = ref ? new Date(ref).getTime() : 0;
      const staleDays = refTime ? Math.floor((now - refTime) / (1000 * 60 * 60 * 24)) : null;
      if (refTime && now - refTime > MS_STALE) {
        items.push({
          id: `stale-${p.id}`,
          projectName: p.name,
          projectId: `stale-${p.id}`,
          reason: staleDays ? `${staleDays} dias sem atualização` : 'Sem atualização registrada',
          responsible: p.engineer_name ?? null,
          urgency: (staleDays ?? 8) >= 14 ? 'high' : 'medium',
          deadline: null,
          icon: <ClipboardX className="h-4 w-4" />,
          cta: 'Ver todas',
        });
      }
    }

    if (s && p.status === 'active' && s.overdue_count > 0) {
      items.push({
        id: `health-${p.id}`,
        projectName: p.name,
        projectId: p.id,
        reason: `${s.overdue_count} item(ns) em atraso`,
        responsible: p.engineer_name ?? null,
        urgency: 'critical',
        deadline: null,
        icon: <HeartPulse className="h-4 w-4" />,
        cta: 'Verificar',
      });
    }

    if (p.planned_end_date && p.status === 'active') {
      const diff = new Date(p.planned_end_date).getTime() - now;
      if (diff >= 0 && diff <= MS_7D) {
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        items.push({
          id: `milestone-${p.id}`,
          projectName: p.name,
          projectId: p.id,
          reason: 'Prazo final se aproximando',
          responsible: p.engineer_name ?? null,
          urgency: days <= 2 ? 'critical' : 'high',
          deadline: `${days}d`,
          icon: <Milestone className="h-4 w-4" />,
          cta: 'Ver',
        });
      }
    }
  }

  const urgencyOrder: Record<Urgency, number> = { critical: 0, high: 1, medium: 2 };
  items.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return items;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PortfolioActionInbox({ projects, summaries, onNavigate }: PortfolioActionInboxProps) {
  const items = useMemo(() => buildActionItems(projects, summaries), [projects, summaries]);

  const displayed = items.slice(0, 8);
  const remaining = items.length - displayed.length;

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden" role="region" aria-label="Ações prioritárias">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-muted/15">
        <div className="flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ações Prioritárias
          </h3>
          {items.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold tabular-nums">
              {items.length}
            </Badge>
          )}
        </div>
        {remaining > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary gap-0.5 px-2">
            +{remaining} <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Items */}
      {displayed.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/10 mb-2">
            <span className="text-lg" aria-hidden="true">✓</span>
          </div>
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nenhuma ação urgente no momento
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/20">
          {displayed.map((item) => {
            const cfg = urgencyConfig[item.urgency];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    'group flex items-start gap-2.5 w-full text-left px-3 py-2.5',
                    'hover:bg-muted/20 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  )}
                  onClick={() => onNavigate?.(item.projectId)}
                  aria-label={`${item.projectName}: ${item.reason}`}
                >
                  {/* Icon */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', cfg.iconBg)}>
                      {item.icon}
                    </div>
                    <div className={cn(
                      'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-card',
                      cfg.dot,
                      item.urgency === 'critical' && 'animate-pulse'
                    )} aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate leading-tight">
                      {item.projectName}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                      {item.reason}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.responsible && (
                        <span className="text-[10px] text-muted-foreground/70 truncate">
                          {item.responsible}
                        </span>
                      )}
                      {item.deadline && (
                        <Badge variant="outline" className={cn('h-4 px-1.5 text-[9px] font-semibold', cfg.badge)}>
                          {item.deadline}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* CTA — visible on mobile, hover on desktop */}
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-[11px] font-medium text-primary shrink-0 mt-1',
                      'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100 transition-opacity'
                    )}
                    aria-hidden="true"
                  >
                    {item.cta}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
