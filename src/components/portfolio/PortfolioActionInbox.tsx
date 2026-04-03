import { useMemo } from 'react';
import {
  FileSignature, Ban, FileX, ClipboardX, Milestone,
  TrendingDown, HeartPulse, ChevronRight, ArrowRight, Inbox,
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

const urgencyConfig: Record<Urgency, { badge: string; dot: string; label: string }> = {
  critical: {
    badge: 'bg-red-500/10 text-red-600 border-red-500/20',
    dot: 'bg-red-500',
    label: 'Crítico',
  },
  high: {
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Alto',
  },
  medium: {
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dot: 'bg-blue-500',
    label: 'Médio',
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
  const MS_48H = 48 * 60 * 60 * 1000;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;
  const items: ActionItem[] = [];

  for (const p of projects) {
    const s = summaryMap.get(p.id);

    // Unsigned formalizations
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

    // Blocked (paused)
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

    // Pending documents
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

    // Stale 48h (active only)
    if (p.status === 'active') {
      const lastActivity = s?.last_activity_at ? new Date(s.last_activity_at).getTime() : 0;
      if (!lastActivity || now - lastActivity > MS_48H) {
        items.push({
          id: `stale-${p.id}`,
          projectName: p.name,
          projectId: p.id,
          reason: 'Sem atualização há 48h+',
          responsible: p.engineer_name ?? null,
          urgency: 'medium',
          deadline: null,
          icon: <ClipboardX className="h-4 w-4" />,
          cta: 'Atualizar',
        });
      }
    }

    // Health dropped — overdue items as proxy
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

    // Milestone within 7 days
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

  // Sort by urgency priority
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
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
            <span className="text-lg">✓</span>
          </div>
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Nenhuma ação urgente no momento
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {displayed.map((item) => {
            const cfg = urgencyConfig[item.urgency];
            return (
              <div
                key={item.id}
                className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => onNavigate?.(item.projectId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate?.(item.projectId)}
              >
                {/* Urgency dot + icon */}
                <div className="relative shrink-0 mt-0.5">
                  <div className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-lg',
                    item.urgency === 'critical' ? 'bg-red-500/10 text-red-600' :
                    item.urgency === 'high' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-blue-500/10 text-blue-600'
                  )}>
                    {item.icon}
                  </div>
                  <div className={cn(
                    'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
                    cfg.dot,
                    item.urgency === 'critical' && 'animate-pulse'
                  )} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {item.projectName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
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

                {/* CTA */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.(item.projectId);
                  }}
                >
                  {item.cta}
                  <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
