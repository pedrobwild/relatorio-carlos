import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  FileText,
  FileSignature,
  AlertTriangle,
  CheckCircle,
  Calendar,
  User,
  Building2,
  MapPin,
  Ruler,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, getTodayLocal } from "@/lib/activityStatus";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { ProjectSummary } from "@/infra/repositories/projects.repository";

// ─── Status config ───────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  draft: {
    label: "Rascunho",
    icon: "✎",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  },
  active: {
    label: "Em andamento",
    icon: "●",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  completed: {
    label: "Concluída",
    icon: "✓",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  paused: {
    label: "Pausada",
    icon: "‖",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  cancelled: {
    label: "Cancelada",
    icon: "✕",
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

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

  const progress = summary?.progress_percentage ?? 0;
  const contractValue = project.contract_value ?? 0;

  const today = getTodayLocal();
  const plannedEnd = project.planned_end_date
    ? parseLocalDate(project.planned_end_date)
    : null;
  const actualEnd = project.actual_end_date
    ? parseLocalDate(project.actual_end_date)
    : null;
  const isFinished = !!actualEnd;
  const daysRemaining =
    plannedEnd && !isFinished ? differenceInDays(plannedEnd, today) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  const blockers: { icon: React.ReactNode; label: string; accent: string }[] =
    [];
  if (summary && summary.overdue_count > 0) {
    blockers.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: `${summary.overdue_count} item(ns) em atraso`,
      accent: "text-destructive",
    });
  }
  if (summary && summary.unsigned_formalizations > 0) {
    blockers.push({
      icon: <FileSignature className="h-3.5 w-3.5" />,
      label: `${summary.unsigned_formalizations} assinatura(s) pendente(s)`,
      accent: "text-amber-600",
    });
  }
  if (summary && summary.pending_documents > 0) {
    blockers.push({
      icon: <FileText className="h-3.5 w-3.5" />,
      label: `${summary.pending_documents} documento(s) pendente(s)`,
      accent: "text-amber-600",
    });
  }
  if (project.status === "paused") {
    blockers.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "Obra pausada — aguardando desbloqueio",
      accent: "text-destructive",
    });
  }

  let lastActivity: string | null = null;
  if (summary?.last_activity_at) {
    try {
      lastActivity = format(
        new Date(summary.last_activity_at),
        "dd/MM/yyyy'às' HH:mm",
        { locale: ptBR },
      );
    } catch {
      lastActivity = null;
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-[440px] overflow-y-auto p-0 flex flex-col"
        aria-describedby={undefined}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-border/30 space-y-3">
          <SheetHeader className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-base font-bold leading-snug pr-4 sm:text-lg">
                {project.name}
              </SheetTitle>
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[11px] gap-1", status.color)}
              >
                <span aria-hidden="true">{status.icon}</span>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {project.customer_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                {project.customer_name}
              </span>
            )}
            {project.unit_name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                {project.unit_name}
              </span>
            )}
            {project.cidade && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                {project.cidade}
              </span>
            )}
            {project.tamanho_imovel_m2 && (
              <span className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                {project.tamanho_imovel_m2}m²
              </span>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">
          {/* Progress */}
          <Section title="Progresso" icon={<Clock className="h-3.5 w-3.5" />}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Progresso</span>
                <span className="text-xs font-bold tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          </Section>

          <Section title="Prazo" icon={<Calendar className="h-3.5 w-3.5" />}>
            <div className="space-y-1.5 text-sm">
              <Row
                label="Início"
                value={
                  project.planned_start_date
                    ? format(
                        parseLocalDate(project.planned_start_date),
                        "dd/MM/yyyy",
                        { locale: ptBR },
                      )
                    : "A definir"
                }
              />
              <Row
                label="Término previsto"
                value={
                  plannedEnd
                    ? format(plannedEnd, "dd/MM/yyyy", { locale: ptBR })
                    : "A definir"
                }
              />
              {daysRemaining !== null && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground text-xs">Status</span>
                  {isOverdue ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {Math.abs(daysRemaining)}d de atraso
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {daysRemaining}d restantes
                    </span>
                  )}
                </div>
              )}
              {isFinished && (
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 pt-1">
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />{" "}
                  Entregue
                </div>
              )}
            </div>
          </Section>

          {/* Blockers */}
          {blockers.length > 0 && (
            <Section
              title="O que está travando"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            >
              <ul className="space-y-2">
                {blockers.map((b, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium",
                      b.accent,
                    )}
                  >
                    <span aria-hidden="true">{b.icon}</span>
                    {b.label}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Pendências */}
          {summary &&
            (summary.pending_count > 0 || summary.overdue_count > 0) && (
              <Section
                title="Pendências"
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Total" value={summary.pending_count} />
                  <MiniStat
                    label="Em atraso"
                    value={summary.overdue_count}
                    accent={
                      summary.overdue_count > 0 ? "destructive" : "default"
                    }
                  />
                </div>
              </Section>
            )}

          {/* Docs + Signatures */}
          {summary &&
            (summary.pending_documents > 0 ||
              summary.unsigned_formalizations > 0) && (
              <Section
                title="Documentos & Assinaturas"
                icon={<FileText className="h-3.5 w-3.5" />}
              >
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Docs pendentes"
                    value={summary.pending_documents}
                    accent={
                      summary.pending_documents > 0 ? "warning" : "default"
                    }
                  />
                  <MiniStat
                    label="Assinaturas"
                    value={summary.unsigned_formalizations}
                    accent={
                      summary.unsigned_formalizations > 0
                        ? "warning"
                        : "default"
                    }
                  />
                </div>
              </Section>
            )}

          {/* Financial */}
          {contractValue > 0 && (
            <Section
              title="Financeiro"
              icon={<DollarSign className="h-3.5 w-3.5" />}
            >
              <Row
                label="Valor do contrato"
                value={`R$ ${contractValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                bold
              />
            </Section>
          )}

          {/* Last activity */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/20">
            <span>Última atualização</span>
            <span className="font-medium tabular-nums">
              {lastActivity ?? "Sem registro"}
            </span>
          </div>
        </div>

        {/* ── Footer CTA ─────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-border/30 bg-muted/5">
          <Button
            className="w-full gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
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

// ─── Sub-components ──────────────────────────────────────────────────────────

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
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={cn(
          "text-xs tabular-nums",
          bold ? "font-bold text-foreground" : "font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number | string;
  accent?: "default" | "warning" | "destructive";
}) {
  const colors = {
    default: "text-foreground",
    warning: "text-amber-600",
    destructive: "text-destructive",
  };
  return (
    <div className="rounded-lg bg-muted/20 px-3 py-2">
      <p
        className={cn(
          "text-lg font-bold tabular-nums leading-none",
          colors[accent],
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground font-medium mt-1">
        {label}
      </p>
    </div>
  );
}
