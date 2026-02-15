import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo.png";
import {
  FileText, DollarSign, ClipboardSignature, User, Phone, Mail,
  ChevronDown, Calendar, Clock, CheckCircle2, AlertTriangle, Activity as ActivityIcon,
  TrendingUp, TrendingDown, Bell, AlertCircle, FolderOpen, Pencil, ArrowLeft, Map,
  ChevronsUpDown, Building2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity } from "@/types/report";
import { usePendencias } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useTeamContacts, TeamContact as TeamContactData } from "@/hooks/useTeamContacts";
import { TeamContactEditModal } from "@/components/TeamContactEditModal";
import { TeamContactPopover } from "@/components/TeamContactPopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/header/StatusBadge";
import { ProgressSection } from "@/components/header/ProgressSection";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MilestoneDates {
  dateBriefingArch?: string | null;
  dateApproval3d?: string | null;
  dateApprovalExec?: string | null;
  dateApprovalObra?: string | null;
  dateOfficialStart?: string | null;
  dateOfficialDelivery?: string | null;
  dateMobilizationStart?: string | null;
}

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  activities: Activity[];
  isProjectPhase?: boolean;
  milestoneDates?: MilestoneDates;
}

interface LegacyTeamContact {
  role: string;
  name: string;
  phone: string;
  email: string;
  crea?: string;
  photo_url?: string;
}

// Calculate working days between two dates (excluding weekends)
const calculateWorkingDays = (start: Date, end: Date): number => {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const ReportHeader = ({
  projectName,
  unitName,
  clientName,
  startDate,
  endDate,
  reportDate,
  activities,
  isProjectPhase = false,
  milestoneDates,
}: ReportHeaderProps) => {
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [showDateChangeAlert, setShowDateChangeAlert] = useState(false);
  const [editingContact, setEditingContact] = useState<TeamContactData | null>(null);

  // Date change info (hardcoded for now, could come from props or API)
  const dateChangeInfo = {
    originalDate: "2025-09-14",
    newDate: "2025-09-17",
    reason: "Atraso no pagamento da parcela de 45 dias",
    contractClause: "5.1.2"
  };

  // Use modified end date if applicable
  const effectiveEndDate = endDate === dateChangeInfo.originalDate ? dateChangeInfo.newDate : endDate;

  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(effectiveEndDate + "T00:00:00");
    const report = new Date(reportDate + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalWorkingDays = calculateWorkingDays(start, end);
    const hasStarted = today >= start;
    const elapsedWorkingDays = hasStarted ? calculateWorkingDays(start, today) : 0;
    const remainingWorkingDays = !hasStarted
      ? totalWorkingDays
      : (today < end ? calculateWorkingDays(today, end) : 0);

    const hasWeights = activities.some(a => (a as any).weight !== undefined);
    const totalWeight = hasWeights
      ? activities.reduce((sum, a) => sum + ((a as any).weight || 0), 0)
      : activities.length;

    const completedWeight = activities.reduce((sum, a) => {
      if (a.actualEnd) {
        return sum + (hasWeights ? ((a as any).weight || 0) : 1);
      }
      return sum;
    }, 0);
    const completedActivities = activities.filter(a => a.actualEnd).length;
    const totalActivities = activities.length;
    const actualProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;

    const plannedWeight = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= report) {
        return sum + (hasWeights ? ((a as any).weight || 0) : 1);
      }
      return sum;
    }, 0);
    const plannedProgress = totalWeight > 0 ? (plannedWeight / totalWeight) * 100 : 0;

    const progressDiff = actualProgress - plannedProgress;
    const isOnTrack = progressDiff >= 0;
    const variancePercentage = Math.abs(progressDiff).toFixed(0);

    const currentActivity = activities.find(a => {
      const plannedStart = new Date(a.plannedStart + "T00:00:00");
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      return plannedStart <= report && plannedEnd >= report && !a.actualEnd;
    }) || activities.find(a => !a.actualEnd);

    return {
      totalWorkingDays,
      elapsedWorkingDays,
      remainingWorkingDays,
      actualProgress: Math.round(actualProgress),
      plannedProgress: Math.round(plannedProgress),
      isOnTrack,
      variancePercentage,
      progressDiff: Math.round(progressDiff),
      currentActivity: currentActivity?.description || "Sem atividade em andamento",
      completedActivities,
      totalActivities
    };
  }, [startDate, effectiveEndDate, reportDate, activities]);

  const { paths, projectId } = useProjectNavigation();
  const { isStaff } = useUserRole();
  const { data: projects = [] } = useProjectsQuery();
  const navigate = useNavigate();

  const {
    contacts: dbContacts,
    upsertContact,
    isUpserting,
    uploadPhoto,
    isUploading,
    roleLabels
  } = useTeamContacts(projectId);

  const otherProjects = useMemo(() => {
    return projects.filter(p => p.id !== projectId);
  }, [projects, projectId]);

  const handleProjectSwitch = (targetProjectId: string) => {
    navigate(`/obra/${targetProjectId}/relatorio`);
  };

  const teamContacts: LegacyTeamContact[] = useMemo(() => {
    const mapped = dbContacts.map(c => ({
      role: roleLabels[c.role_type] || c.role_type,
      name: c.display_name,
      phone: c.phone || '',
      email: c.email || '',
      crea: c.crea || undefined,
      photo_url: c.photo_url || undefined,
    }));
    return isProjectPhase && !isStaff
      ? mapped.filter(c => c.role !== 'Engenharia')
      : mapped;
  }, [dbContacts, isProjectPhase, isStaff, roleLabels]);

  const getDbContactByRole = (role: string) => {
    const roleTypeMap: Record<string, string> = {
      'Engenharia': 'engenharia',
      'Arquitetura': 'arquitetura',
      'Relacionamento': 'relacionamento',
    };
    const roleType = roleTypeMap[role];
    return dbContacts.find(c => c.role_type === roleType);
  };

  const handleEditContact = (role: string) => {
    const contact = getDbContactByRole(role);
    if (contact) {
      setEditingContact(contact);
    }
  };

  const toggleContact = (role: string) => {
    setExpandedContact(expandedContact === role ? null : role);
  };

  const { stats: pendenciasStats } = usePendencias({ projectId });

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
    }
  };

  const showMetrics = !(isProjectPhase && !isStaff);

  // Effective dates for display
  const displayStartDate = milestoneDates?.dateOfficialStart || startDate;
  const displayEndDate = milestoneDates?.dateOfficialDelivery || effectiveEndDate;

  // Milestones that have values
  const milestoneItems = useMemo(() => {
    const items = [
      { label: "Briefing Arq.", value: milestoneDates?.dateBriefingArch },
      { label: "Aprov. 3D", value: milestoneDates?.dateApproval3d },
      { label: "Aprov. Executivo", value: milestoneDates?.dateApprovalExec },
      { label: "Aprov. Obra", value: milestoneDates?.dateApprovalObra },
      { label: "Início Mobilização", value: milestoneDates?.dateMobilizationStart },
    ];
    return items;
  }, [milestoneDates]);

  return (
    <header className="animate-fade-in mb-3 md:mb-4">
      {/* ============== DESKTOP LAYOUT ============== */}
      <div className="hidden md:block">
        {/* ── L1: Identity + Signals ── */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            {/* Left: Back + Logo + Project Selector */}
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="h-9 w-9 shrink-0 rounded-full hover:bg-accent"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <img src={bwildLogo} alt="Bwild" className="h-7 w-auto shrink-0" />
              <Separator orientation="vertical" className="h-6" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors group min-w-0">
                    <div className="min-w-0">
                      <h1 className="text-base font-bold leading-tight group-hover:text-primary transition-colors truncate">
                        {projectName} – {unitName}
                      </h1>
                      {clientName && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Cliente: {clientName}</p>
                      )}
                    </div>
                    {otherProjects.length > 0 && (
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                {otherProjects.length > 0 && (
                  <DropdownMenuContent align="start" className="w-72 bg-popover">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Trocar de Obra
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {otherProjects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className="flex flex-col items-start gap-0.5 cursor-pointer"
                      >
                        <span className="font-medium">
                          {project.name} {project.unit_name && `– ${project.unit_name}`}
                        </span>
                        {project.customer_name && (
                          <span className="text-xs text-muted-foreground">
                            Cliente: {project.customer_name}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            </div>

            {/* Right: Pendências + Status Badge */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                to={paths.pendencias}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors font-semibold text-sm border",
                  pendenciasStats.overdueCount > 0
                    ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                      : 'bg-secondary text-muted-foreground border-border hover:bg-accent'
                )}
                aria-label={`${pendenciasStats.total} pendências`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="text-xs">Pendências</span>
                <Badge
                  variant={pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"}
                  className={cn(
                    "min-w-5 h-5 px-1.5 text-xs font-bold",
                    pendenciasStats.overdueCount > 0
                      ? ''
                      : pendenciasStats.urgentCount > 0
                        ? 'bg-warning text-warning-foreground'
                        : 'bg-muted-foreground text-white'
                  )}
                >
                  {pendenciasStats.total}
                </Badge>
              </Link>

            </div>
          </div>

          {/* ── L2: Project State (inline) ── */}
          {showMetrics && (
            <div className="px-5 py-2.5 border-t border-border bg-secondary/15 flex items-center gap-4 flex-wrap">
              {/* Current Activity */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <ActivityIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-semibold text-foreground truncate cursor-default">
                        {projectMetrics.currentActivity}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[300px]">
                      <p>{projectMetrics.currentActivity}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-5 font-medium tabular-nums">
                  {projectMetrics.completedActivities}/{projectMetrics.totalActivities}
                </Badge>
              </div>

              <Separator orientation="vertical" className="h-5 hidden lg:block" />

              {/* Key Dates */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Início</span>
                  <span className="text-xs font-semibold tabular-nums">{formatDateShort(displayStartDate)}</span>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Entrega</span>
                  <button
                    onClick={endDate === dateChangeInfo.originalDate ? () => setShowDateChangeAlert(true) : undefined}
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      endDate === dateChangeInfo.originalDate && "text-warning underline decoration-dotted cursor-pointer"
                    )}
                  >
                    {formatDateShort(displayEndDate)}
                  </button>
                  {endDate === dateChangeInfo.originalDate && (
                    <AlertCircle className="w-3 h-3 text-warning" />
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Milestones: compact horizontal row inside header */}
          {showMetrics && (
            <div className="px-5 py-2 border-t border-border bg-secondary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marcos do Projeto</span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {milestoneItems.map((m) => (
                  <div key={m.label} className="flex items-baseline gap-1.5">
                    <span className="text-[11px] text-muted-foreground">{m.label}:</span>
                    <span className="text-[11px] font-semibold tabular-nums text-foreground">
                      {m.value ? formatDateFull(m.value) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Summary Area: Progress Bars ── */}
        {showMetrics && (
          <div className="mt-3 bg-card rounded-xl border border-border shadow-sm p-5">
            <ProgressSection
              elapsedWorkingDays={projectMetrics.elapsedWorkingDays}
              totalWorkingDays={projectMetrics.totalWorkingDays}
              remainingWorkingDays={projectMetrics.remainingWorkingDays}
              actualProgress={projectMetrics.actualProgress}
              plannedProgress={projectMetrics.plannedProgress}
              isOnTrack={projectMetrics.isOnTrack}
              isStaff={isStaff}
              hasActivities={activities.length > 0}
              cronogramaPath={paths.cronograma}
              isProjectPhase={isProjectPhase}
            />

          </div>
        )}
      </div>

      {/* ============== MOBILE LAYOUT ============== */}
      <div className="md:hidden">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="h-8 w-8 rounded-full"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-5 w-auto" />
            </div>

            <Link
              to={paths.pendencias}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors border",
                pendenciasStats.overdueCount > 0
                  ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                  : pendenciasStats.urgentCount > 0
                    ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                    : 'bg-secondary text-muted-foreground border-border hover:bg-accent'
              )}
              aria-label={`${pendenciasStats.total} pendências`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Pendências</span>
              <Badge
                variant={pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"}
                className={cn(
                  "min-w-4 h-4 px-1 text-[10px] font-bold",
                  pendenciasStats.overdueCount > 0
                    ? ''
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning text-warning-foreground'
                      : 'bg-muted-foreground text-white'
                )}
              >
                {pendenciasStats.total}
              </Badge>
            </Link>
          </div>

          {/* Project Info */}
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-md px-1.5 py-1 -ml-1.5 transition-colors group min-w-0">
                    <div className="min-w-0">
                      <h1 className="text-[15px] font-bold leading-tight group-hover:text-primary transition-colors truncate">
                        {projectName} – {unitName}
                      </h1>
                      {clientName && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Cliente: {clientName}</p>
                      )}
                    </div>
                    {otherProjects.length > 0 && (
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                {otherProjects.length > 0 && (
                  <DropdownMenuContent align="start" className="w-64 bg-popover">
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                      <Building2 className="h-3.5 w-3.5" />
                      Trocar de Obra
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {otherProjects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className="flex flex-col items-start gap-0.5 cursor-pointer"
                      >
                        <span className="font-medium text-sm">
                          {project.name} {project.unit_name && `– ${project.unit_name}`}
                        </span>
                        {project.customer_name && (
                          <span className="text-xs text-muted-foreground">
                            Cliente: {project.customer_name}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            </div>

            {/* Mobile: Inline state */}
            {showMetrics && (
              <>
                {/* Dates + Progress inline */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateShort(displayStartDate)}</span>
                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                    <span>{formatDateShort(displayEndDate)}</span>
                  </div>
                </div>

                {/* Current Activity compact */}
                <div className="bg-secondary/30 rounded-lg p-2.5 mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ActivityIcon className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa Atual</span>
                    <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 h-4 font-medium tabular-nums">
                      {projectMetrics.completedActivities}/{projectMetrics.totalActivities}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1 leading-tight">
                    {projectMetrics.currentActivity}
                  </p>
                </div>

                {/* Milestones compact - mobile */}
                <div className="mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marcos</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                    {milestoneItems.map((m) => (
                      <div key={m.label} className="flex items-baseline justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground truncate">{m.label}</span>
                        <span className="text-[10px] font-semibold tabular-nums text-foreground shrink-0">
                          {m.value ? formatDateShort(m.value) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {projectMetrics.elapsedWorkingDays}/{projectMetrics.totalWorkingDays} dias úteis
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      Restam {projectMetrics.remainingWorkingDays}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={projectMetrics.elapsedWorkingDays} aria-valuemax={projectMetrics.totalWorkingDays}>
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                      style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile: Summary area below */}
        {showMetrics && (
          <div className="mt-2 bg-card rounded-xl border border-border shadow-sm p-3">
            {/* Work progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Progresso da Obra</span>
                <span className={cn(
                  "text-xs font-bold tabular-nums",
                  projectMetrics.isOnTrack ? "text-success" : "text-warning"
                )}>{projectMetrics.actualProgress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={projectMetrics.actualProgress} aria-valuemax={100}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    projectMetrics.isOnTrack ? "bg-success" : "bg-warning"
                  )}
                  style={{ width: `${projectMetrics.actualProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                <span>Previsto: {projectMetrics.plannedProgress}%</span>
                <span>Realizado: {projectMetrics.actualProgress}%</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Date Change Alert Dialog */}
      <AlertDialog open={showDateChangeAlert} onOpenChange={setShowDateChangeAlert}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="w-5 h-5" />
              Prazo Final Alterado
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <p>
                A data prevista de término foi alterada de{" "}
                <span className="font-semibold line-through text-muted-foreground">
                  {formatDateFull(dateChangeInfo.originalDate)}
                </span>{" "}
                para{" "}
                <span className="font-semibold text-foreground">
                  {formatDateFull(dateChangeInfo.newDate)}
                </span>
                .
              </p>
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-sm font-medium text-warning mb-1">
                  Motivo:
                </p>
                <p className="text-sm text-foreground">
                  {dateChangeInfo.reason}, de acordo com a{" "}
                  <span className="font-semibold">
                    cláusula {dateChangeInfo.contractClause}
                  </span>{" "}
                  do contrato.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Contact Edit Modal */}
      <TeamContactEditModal
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        contact={editingContact}
        roleLabel={editingContact ? roleLabels[editingContact.role_type] : ''}
        onSave={async (data) => {
          await upsertContact(data);
        }}
        onUploadPhoto={async (file) => {
          if (!editingContact) throw new Error('No contact selected');
          return uploadPhoto({ file, roleType: editingContact.role_type });
        }}
        isSaving={isUpserting}
        isUploading={isUploading}
      />
    </header>
  );
};

export default ReportHeader;
