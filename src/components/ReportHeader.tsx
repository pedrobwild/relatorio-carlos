import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import {
  FileText, DollarSign, ClipboardSignature, User, Phone, Mail,
  ChevronDown, Calendar as CalendarIcon, Clock, CheckCircle2, AlertTriangle, Activity as ActivityIcon,
  TrendingUp, TrendingDown, Bell, AlertCircle, FolderOpen, Pencil, ArrowLeft, Map,
  ChevronsUpDown, Building2, ChevronRight, Milestone, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Activity } from "@/types/report";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendencias } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
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
  contractSigningDate?: string | null;
}

export type MilestoneKey = 'dateBriefingArch' | 'dateApproval3d' | 'dateApprovalExec' | 'dateApprovalObra' | 'dateMobilizationStart' | 'contractSigningDate';

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string | null;
  endDate: string | null;
  reportDate: string;
  activities: Activity[];
  isProjectPhase?: boolean;
  milestoneDates?: MilestoneDates;
  canEditMilestones?: boolean;
  onMilestoneDateChange?: (key: MilestoneKey, date: string | null) => Promise<void>;
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
  canEditMilestones = false,
  onMilestoneDateChange,
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

    const hasWeights = activities.some(a => a.weight !== undefined);
    const totalWeight = hasWeights
      ? activities.reduce((sum, a) => sum + (a.weight || 0), 0)
      : activities.length;

    const completedWeight = activities.reduce((sum, a) => {
      if (a.actualEnd) {
        return sum + (hasWeights ? (a.weight || 0) : 1);
      }
      return sum;
    }, 0);
    const completedActivities = activities.filter(a => a.actualEnd).length;
    const totalActivities = activities.length;
    const actualProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    const plannedWeight = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= report) {
        return sum + (hasWeights ? (a.weight || 0) : 1);
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
  const { project: currentProject } = useProject();
  const isMobile = useIsMobile();
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
    const items: { label: string; value: string | null | undefined; key: MilestoneKey }[] = [
      { label: "Assin. Contrato", value: milestoneDates?.contractSigningDate, key: 'contractSigningDate' },
      { label: "Briefing Arq.", value: milestoneDates?.dateBriefingArch, key: 'dateBriefingArch' },
      { label: "Aprov. 3D", value: milestoneDates?.dateApproval3d, key: 'dateApproval3d' },
      { label: "Aprov. Executivo", value: milestoneDates?.dateApprovalExec, key: 'dateApprovalExec' },
      { label: "Aprov. Obra", value: milestoneDates?.dateApprovalObra, key: 'dateApprovalObra' },
      { label: "Início Mobilização", value: milestoneDates?.dateMobilizationStart, key: 'dateMobilizationStart' },
    ];
    return items;
  }, [milestoneDates]);

  const [editingMilestone, setEditingMilestone] = useState<MilestoneKey | null>(null);
  const [savingMilestone, setSavingMilestone] = useState(false);

  const handleMilestoneDateSelect = useCallback(async (key: MilestoneKey, date: Date | undefined) => {
    if (!onMilestoneDateChange) return;
    setSavingMilestone(true);
    try {
      const dateStr = date ? date.toISOString().split('T')[0] : null;
      await onMilestoneDateChange(key, dateStr);
    } finally {
      setSavingMilestone(false);
      setEditingMilestone(null);
    }
  }, [onMilestoneDateChange]);

  const handleClearMilestoneDate = useCallback(async (key: MilestoneKey) => {
    if (!onMilestoneDateChange) return;
    setSavingMilestone(true);
    try {
      await onMilestoneDateChange(key, null);
    } finally {
      setSavingMilestone(false);
      setEditingMilestone(null);
    }
  }, [onMilestoneDateChange]);

  return (
    <header className="animate-fade-in mb-3 md:mb-4">
      {/* ============== DESKTOP LAYOUT ============== */}
      <div className="hidden md:block">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* ── L1: Identity Bar ── */}
          <div className="px-6 py-3.5 flex items-center justify-between gap-4">
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

              <img src={bwildLogo} alt="Bwild" className="h-8 w-auto shrink-0" />
              <Separator orientation="vertical" className="h-6" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-3 py-2 transition-colors group min-w-0">
                    <div className="min-w-0">
                      <h1 className="text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors truncate">
                        {projectName} – {unitName}
                      </h1>
                      {clientName && (
                        <p className="text-caption mt-0.5 truncate">Cliente: {clientName}</p>
                      )}
                       {(() => {
                         const addressParts = [currentProject?.address, currentProject?.bairro, currentProject?.cep].filter(Boolean);
                        return addressParts.length > 0 ? (
                          <p className="text-xs text-muted-foreground truncate">{addressParts.join(' · ')}</p>
                        ) : null;
                      })()}
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

            {/* Right: Pendências */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                to={paths.pendencias}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-full transition-all font-semibold text-sm border",
                  "hover:shadow-sm active:scale-[0.97]",
                  pendenciasStats.overdueCount > 0
                    ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                      : 'bg-secondary text-foreground border-border hover:bg-accent'
                )}
                aria-label={`${pendenciasStats.total} pendências`}
              >
                <Bell className="w-4 h-4" />
                <span className="text-sm">Pendências</span>
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

          {/* ── L2: Project State ── */}
          {showMetrics && (
            <div className="px-6 py-3 border-t border-border bg-muted/30">
              <div className="flex items-start gap-6 flex-wrap">
                {/* Current Stage */}
                <div className="flex-1 min-w-0">
                  <span className="text-meta font-semibold uppercase tracking-wider block mb-1">
                    Etapa Atual
                  </span>
                  <p className="text-body font-semibold text-foreground break-words leading-snug">
                    {projectMetrics.currentActivity}
                  </p>
                  <Badge variant="secondary" className="mt-1.5 text-meta px-2 py-0.5 h-auto font-medium tabular-nums">
                    {projectMetrics.completedActivities} de {projectMetrics.totalActivities} atividades
                  </Badge>
                </div>

                <Separator orientation="vertical" className="h-12 hidden lg:block self-center" />

                {/* Key Dates — inline */}
                <div className="flex items-center gap-3 shrink-0 self-center">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-caption">Início</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{startDate ? formatDateShort(displayStartDate) : '—'}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-caption">Entrega</span>
                    <button
                      onClick={endDate === dateChangeInfo.originalDate ? () => setShowDateChangeAlert(true) : undefined}
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        endDate === dateChangeInfo.originalDate
                          ? "text-warning underline decoration-dotted decoration-warning/50 cursor-pointer hover:decoration-warning"
                          : "text-foreground cursor-default"
                      )}
                    >
                      {endDate ? formatDateShort(displayEndDate) : '—'}
                    </button>
                    {endDate === dateChangeInfo.originalDate && (
                      <AlertCircle className="w-3 h-3 text-warning" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── L3: Milestones ── */}
          {showMetrics && (
            <div className="px-6 py-2.5 border-t border-border bg-muted/15">
              <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
                <span className="text-meta font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                  Marcos
                </span>
                <div className="flex items-center gap-3 flex-nowrap shrink-0">
                  {milestoneItems.map((m, i) => (
                    <div key={m.label} className="flex items-center gap-3">
                      {i > 0 && <span className="text-border">·</span>}
                      {canEditMilestones && onMilestoneDateChange && !isMobile ? (
                        <Popover open={editingMilestone === m.key} onOpenChange={(open) => setEditingMilestone(open ? m.key : null)}>
                          <PopoverTrigger asChild>
                            <button className={cn(
                              "flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors",
                              "hover:bg-accent/60 cursor-pointer group"
                            )}>
                              <span className="text-caption whitespace-nowrap">{m.label}</span>
                              <span className={cn(
                                "text-xs font-semibold tabular-nums whitespace-nowrap",
                                m.value ? "text-foreground" : "text-muted-foreground/50"
                              )}>
                                {m.value ? formatDateFull(m.value) : "—"}
                              </span>
                              <Pencil className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 z-[200]"
                            align="start"
                            onPointerDownOutside={(e) => e.preventDefault()}
                            onInteractOutside={(e) => e.preventDefault()}
                          >
                            <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">Marco: {m.label}</span>
                              <div className="flex items-center gap-1">
                                {m.value && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                    onClick={() => handleClearMilestoneDate(m.key)}
                                    disabled={savingMilestone}
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Limpar
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setEditingMilestone(null)}
                                >
                                  Fechar
                                </Button>
                              </div>
                            </div>
                            <Calendar
                              mode="single"
                              selected={m.value ? new Date(m.value + "T00:00:00") : undefined}
                              onSelect={(date) => handleMilestoneDateSelect(m.key, date)}
                              locale={ptBR}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-caption whitespace-nowrap">{m.label}</span>
                          <span className={cn(
                            "text-xs font-semibold tabular-nums whitespace-nowrap",
                            m.value ? "text-foreground" : "text-muted-foreground/50"
                          )}>
                            {m.value ? formatDateFull(m.value) : "—"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Progress Section ── */}
        {showMetrics && (
          <div className="mt-3 bg-card rounded-xl border border-border shadow-sm px-6 py-5">
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
              activities={activities}
              projectStartDate={startDate ?? undefined}
              projectEndDate={effectiveEndDate ?? undefined}
            />
          </div>
        )}
      </div>

      {/* ============== MOBILE LAYOUT ============== */}
      <div className="md:hidden">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Top Bar */}
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
              <img src={bwildLogo} alt="Bwild" className="h-7 w-auto" />
            </div>

            <Link
              to={paths.pendencias}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all border",
                "active:scale-[0.97]",
                pendenciasStats.overdueCount > 0
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : pendenciasStats.urgentCount > 0
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-secondary text-foreground border-border'
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
            <div className="mb-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-lg px-2 py-1.5 -ml-2 transition-colors group min-w-0 w-full">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-[15px] font-bold leading-tight text-foreground group-hover:text-primary transition-colors truncate">
                        {projectName} – {unitName}
                      </h1>
                      {clientName && (
                        <p className="text-caption mt-0.5">Cliente: {clientName}</p>
                      )}
                       {(() => {
                         const addressParts = [currentProject?.address, currentProject?.bairro, currentProject?.cep].filter(Boolean);
                        return addressParts.length > 0 ? (
                          <p className="text-xs text-muted-foreground truncate">{addressParts.join(' · ')}</p>
                        ) : null;
                      })()}
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

            {/* Mobile: Project State */}
            {showMetrics && (
              <>
                {/* Current Stage */}
                <div className="bg-muted/40 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-meta font-semibold uppercase tracking-wider">Etapa Atual</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium tabular-nums">
                      {projectMetrics.completedActivities}/{projectMetrics.totalActivities}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug break-words">
                    {projectMetrics.currentActivity}
                  </p>
                </div>

                {/* Dates Row */}
                <div className="flex items-center justify-between gap-3 mb-3 px-1">
                  <div>
                    <span className="text-meta font-semibold uppercase tracking-wider block mb-0.5">Início</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatDateShort(displayStartDate)}</span>
                  </div>
                  <div className="flex-1 h-px bg-border mx-2" />
                  <div className="text-right">
                    <span className="text-meta font-semibold uppercase tracking-wider block mb-0.5">Entrega</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatDateShort(displayEndDate)}</span>
                  </div>
                </div>

                {/* Milestones compact */}
                <div className="mb-3">
                  <span className="text-meta font-semibold uppercase tracking-wider block mb-1.5">Marcos do Projeto</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {milestoneItems.map((m) => (
                      <div key={m.label} className="flex items-baseline justify-between gap-1">
                        {canEditMilestones && onMilestoneDateChange && isMobile ? (
                          <Popover open={editingMilestone === m.key} onOpenChange={(open) => setEditingMilestone(open ? m.key : null)}>
                            <PopoverTrigger asChild>
                              <button className="flex items-baseline justify-between gap-1 w-full rounded px-1 -mx-1 hover:bg-accent/60 transition-colors">
                                <span className="text-caption truncate">{m.label}</span>
                                <span className={cn(
                                  "text-xs font-semibold tabular-nums shrink-0",
                                  m.value ? "text-foreground" : "text-muted-foreground/40"
                                )}>
                                  {m.value ? formatDateShort(m.value) : "—"}
                                </span>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 z-[200]"
                              align="start"
                              onPointerDownOutside={(e) => e.preventDefault()}
                              onInteractOutside={(e) => e.preventDefault()}
                            >
                              <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">Marco: {m.label}</span>
                                <div className="flex items-center gap-1">
                                  {m.value && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                      onClick={() => handleClearMilestoneDate(m.key)}
                                      disabled={savingMilestone}
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Limpar
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => setEditingMilestone(null)}
                                  >
                                    Fechar
                                  </Button>
                                </div>
                              </div>
                              <Calendar
                                mode="single"
                                selected={m.value ? new Date(m.value + "T00:00:00") : undefined}
                                onSelect={(date) => handleMilestoneDateSelect(m.key, date)}
                                locale={ptBR}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <>
                            <span className="text-caption truncate">{m.label}</span>
                            <span className={cn(
                              "text-xs font-semibold tabular-nums shrink-0",
                              m.value ? "text-foreground" : "text-muted-foreground/40"
                            )}>
                              {m.value ? formatDateShort(m.value) : "—"}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-meta tabular-nums">
                      {projectMetrics.elapsedWorkingDays}/{projectMetrics.totalWorkingDays} dias úteis
                    </span>
                    <span className="text-meta tabular-nums">
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

        {/* Mobile: Progress Section */}
        {showMetrics && (
          <div className="mt-2 bg-card rounded-xl border border-border shadow-sm p-3">
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
              activities={activities}
              projectStartDate={startDate ?? undefined}
              projectEndDate={effectiveEndDate ?? undefined}
            />
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
