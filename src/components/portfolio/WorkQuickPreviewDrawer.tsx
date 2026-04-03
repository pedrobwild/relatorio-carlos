import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink, HeartPulse, Clock, FileText, FileSignature,
  AlertTriangle, CheckCircle, Calendar, User, Building2,
  MapPin, Ruler, TrendingDown, Milestone, ArrowRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getTodayLocal } from '@/lib/activityStatus';
import { differenceInDays } from 'date-fns';
import type { ProjectWithCustomer } from '@/infra/repositories';
import type { ProjectSummary } from '@/infra/repositories/projects.repository';

// ─── Status config ───────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Em andamento', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  completed: { label: 'Concluída', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  paused: { label: 'Pausada', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

// ─── Health estimation ───────────────────────────────────────────────────────

function estimateHealth(s: ProjectSummary): { score: number; tier: string; color: string } {
  let score = 100;
  if (s.overdue_count > 0) score -= Math.min(40, s.overdue_count * 15);
  if (s.unsigned_formalizations > 0) score -= Math.min(20, s.unsigned_formalizations * 10);
  if (s.pending_documents > 0) score -= Math.min(15, s.pending_documents * 5);
  if (s.progress_percentage < 20 && s.status === 'active') score -= 10;
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, tier: 'Excelente', color: 'text-emerald-600' };
  if (score >= 60) return { score, tier: 'Bom', color: 'text-blue-600' };
  if (score >= 40) return { score, tier: 'Atenção', color: 'text-amber-600' };
  return { score, tier: 'Crítico', color: 'text-red-600' };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface WorkQuickPreviewDrawerProps {
  project: ProjectWithCustomer | null;
  summary: ProjectSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkQuickPreviewDrawer({
  project,
  summary,
  open,
  onOpenChange,
}: WorkQuickPreviewDrawerProps) {
  const navigate = useNavigate();

  if (!project) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[440px]">
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Selecione uma obra
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const status = statusConfig[project.status] ?? statusConfig.active;
  const health = summary ? estimateHealth(summary) : null;
  const progress = summary?.progress_percentage ?? 0;
  const contractValue = project.contract_value ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date ? parseLocalDate(project.planned_end_date) : null;
  const actualEnd = project.actual_end_date ? parseLocalDate(project.actual_end_date) : null;
  const isFinished = !!actualEnd;
  const daysRemaining = plannedEnd && !isFinished ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  // Build blockers list
  const blockers: { icon: React.ReactNode; label: string; accent: string }[] = [];
  if (summary && summary.overdue_count > 0) {
    blockers.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: `${summary.overdue_count} item(ns) em atraso`,
      accent: 'text-red-600',
    });
  }
  if (summary && summary.unsigned_formalizations > 0) {
    blockers.push({
      icon: <FileSignature className="h-3.5 w-3.5" />,
      label: `${summary.unsigned_formalizations} assinatura(s) pendente(s)`,
      accent: 'text-amber-600',
    });
  }
  if (summary && summary.pending_documents > 0) {
    blockers.push({
      icon: <FileText className="h-3.5 w-3.5" />,
      label: `${summary.pending_documents} documento(s) pendente(s)`,
      accent: 'text-amber-600',
    });
  }
  if (project.status === 'paused') {
    blockers.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: 'Obra pausada — aguardando desbloqueio',
      accent: 'text-red-600',
    });
  }

  // Last activity
  const lastActivity = summary?.last_activity_at
    ? format(new Date(summary.last_activity_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[440px] overflow-y-auto p-0 flex flex-col">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40 space-y-3">
          <SheetHeader className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-bold leading-tight pr-4">
                {project.name}
              </SheetTitle>
              <Badge variant="outline" className={cn('shrink-0 text-[11px]', status.color)}>
                {status.label}
              </Badge>
            </div>
            {project.is_project_phase && (
              <span className="inline-block text-[11px] font-medium text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full">
                Fase de Projeto
              </span>
            )}
          </SheetHeader>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {project.customer_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {project.customer_name}
              </span>
            )}
            {project.unit_name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {project.unit_name}
              </span>
            )}
            {project.cidade && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {project.cidade}
              </span>
            )}
            {project.tamanho_imovel_m2 && (
              <span className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" /> {project.tamanho_imovel_m2}m²
              </span>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 px-6 py-4 space-y-5 overflow-y-auto">

          {/* Health + Progress */}
          <Section title="Saúde & Progresso" icon={<HeartPulse className="h-3.5 w-3.5" />}>
            <div className="flex items-center gap-4">
              {/* Health ring */}
              {health && (
                <div className="relative shrink-0">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-muted/30" />
                    <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5"
                      strokeDasharray={`${health.score} ${100 - health.score}`}
                      strokeLinecap="round"
                      className={health.color}
                    />
                  </svg>
                  <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums', health.color)}>
                    {health.score}
                  </span>
                </div>
              )}
              <div className="flex-1 space-y-2">
                {health && (
                  <p className={cn('text-sm font-semibold', health.color)}>{health.tier}</p>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Progresso</span>
                    <span className="text-xs font-bold tabular-nums">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Prazo */}
          <Section title="Prazo" icon={<Calendar className="h-3.5 w-3.5" />}>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Início</span>
                <span className="text-xs font-medium tabular-nums">
                  {project.planned_start_date
                    ? format(parseLocalDate(project.planned_start_date), 'dd/MM/yyyy', { locale: ptBR })
                    : 'A definir'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Término previsto</span>
                <span className="text-xs font-medium tabular-nums">
                  {plannedEnd ? format(plannedEnd, 'dd/MM/yyyy', { locale: ptBR }) : 'A definir'}
                </span>
              </div>
              {daysRemaining !== null && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground text-xs">Status</span>
                  {isOverdue ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {Math.abs(daysRemaining)}d de atraso
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Clock className="h-3 w-3" />
                      {daysRemaining}d restantes
                    </span>
                  )}
                </div>
              )}
              {isFinished && (
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 pt-1">
                  <CheckCircle className="h-3 w-3" /> Entregue
                </div>
              )}
            </div>
          </Section>

          {/* Blockers / What's stopping this project */}
          {blockers.length > 0 && (
            <Section title="O que está travando" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                {blockers.map((b, i) => (
                  <div key={i} className={cn('flex items-center gap-2 text-sm', b.accent)}>
                    {b.icon}
                    <span className="text-xs font-medium">{b.label}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pendências summary */}
          {summary && (summary.pending_count > 0 || summary.overdue_count > 0) && (
            <Section title="Pendências" icon={<Clock className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Total" value={summary.pending_count} accent="default" />
                <MiniStat label="Em atraso" value={summary.overdue_count} accent={summary.overdue_count > 0 ? 'destructive' : 'default'} />
              </div>
            </Section>
          )}

          {/* Docs + Signatures */}
          {summary && (summary.pending_documents > 0 || summary.unsigned_formalizations > 0) && (
            <Section title="Documentos & Assinaturas" icon={<FileText className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Docs pendentes"
                  value={summary.pending_documents}
                  accent={summary.pending_documents > 0 ? 'warning' : 'default'}
                />
                <MiniStat
                  label="Assinaturas"
                  value={summary.unsigned_formalizations}
                  accent={summary.unsigned_formalizations > 0 ? 'warning' : 'default'}
                />
              </div>
            </Section>
          )}

          {/* Financial */}
          {contractValue > 0 && (
            <Section title="Financeiro" icon={<TrendingDown className="h-3.5 w-3.5" />}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">Valor do contrato</span>
                <span className="text-sm font-bold tabular-nums">
                  R$ {contractValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </Section>
          )}

          {/* Last activity */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
            <span>Última atualização</span>
            <span className="font-medium tabular-nums">
              {lastActivity ?? 'Sem registro'}
            </span>
          </div>
        </div>

        {/* ── Footer CTA ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/10">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate(`/obra/${project.id}`);
            }}
          >
            Abrir obra completa
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

// ─── Mini stat card ──────────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: number | string;
  accent?: 'default' | 'warning' | 'destructive';
}) {
  const colors = {
    default: 'text-foreground',
    warning: 'text-amber-600',
    destructive: 'text-red-600',
  };

  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className={cn('text-lg font-bold tabular-nums leading-none', colors[accent])}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground font-medium mt-1">{label}</p>
    </div>
  );
}
