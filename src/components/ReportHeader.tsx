import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo.png";
import {
  FileText, DollarSign, ClipboardSignature, User, Phone, Mail,
  ChevronDown, Calendar, Clock, CheckCircle2, AlertTriangle, Activity as ActivityIcon,
  TrendingUp, TrendingDown, Bell, AlertCircle, FolderOpen, Pencil, ArrowLeft, Map,
  ChevronsUpDown, Building2
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
import { KPIStatCard } from "@/components/header/KPIStatCard";
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

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  activities: Activity[];
  isProjectPhase?: boolean;
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

const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return "-";
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

  const quickLinks = [
    ...(isProjectPhase ? [{ icon: Map, label: "Jornada", href: paths.jornada, highlight: true }] : []),
    { icon: DollarSign, label: "Financeiro", href: paths.financeiro, highlight: false },
    { icon: FolderOpen, label: "Documentos", href: paths.documentos, highlight: false },
    { icon: ClipboardSignature, label: "Formalizações", href: paths.formalizacoes, highlight: false },
  ];

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

  return (
    <header className="bg-card rounded-xl border border-border mb-3 md:mb-4 animate-fade-in shadow-sm overflow-hidden">
      {/* ============== DESKTOP LAYOUT ============== */}
      <div className="hidden md:block">
        {/* Top Bar: Navigation + Project Name + Status */}
        <div className="px-5 py-4 flex items-center justify-between gap-4">
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
            <Separator orientation="vertical" className="h-8" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors group min-w-0">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors truncate">
                      {projectName} – {unitName}
                    </h1>
                    {clientName && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">Cliente: {clientName}</p>
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
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={paths.pendencias}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full transition-colors font-semibold text-sm border ${
                pendenciasStats.overdueCount > 0
                  ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                  : pendenciasStats.urgentCount > 0
                    ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                    : 'bg-secondary text-muted-foreground border-border hover:bg-accent'
              }`}
              aria-label={`${pendenciasStats.total} pendências`}
            >
              <Bell className="w-4 h-4" />
              <span>Pendências</span>
              <Badge
                variant={pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"}
                className={`min-w-5 h-5 px-1.5 text-xs font-bold ${
                  pendenciasStats.overdueCount > 0
                    ? ''
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning text-warning-foreground'
                      : 'bg-muted-foreground text-white'
                }`}
              >
                {pendenciasStats.total}
              </Badge>
            </Link>

            <StatusBadge
              isOnTrack={projectMetrics.isOnTrack}
              progressDiff={projectMetrics.progressDiff}
              variancePercentage={projectMetrics.variancePercentage}
              isProjectPhase={isProjectPhase}
              isStaff={isStaff}
            />
          </div>
        </div>

        {/* KPI Metrics Grid */}
        {showMetrics && (
          <div className="px-5 pb-4 border-t border-border pt-4 bg-secondary/20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {/* Current Activity - Larger card */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-2 xl:col-span-2 rounded-xl bg-card border border-border p-3.5 flex flex-col justify-between min-h-[88px]">
                <div className="flex items-center gap-1.5">
                  <ActivityIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-none">Etapa Atual</span>
                </div>
                <div className="mt-auto pt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-sm font-semibold text-foreground line-clamp-1 cursor-default leading-tight">
                          {projectMetrics.currentActivity}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[300px]">
                        <p>{projectMetrics.currentActivity}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {projectMetrics.completedActivities} de {projectMetrics.totalActivities} etapas concluídas
                  </p>
                </div>
              </div>

              {/* Duration */}
              <KPIStatCard
                icon={Clock}
                label="Duração"
                value={projectMetrics.totalWorkingDays}
                unit="dias úteis"
                size="compact"
              />

              {/* Remaining */}
              <KPIStatCard
                icon={projectMetrics.remainingWorkingDays <= 7 ? AlertTriangle : Clock}
                label="Restante"
                value={projectMetrics.remainingWorkingDays}
                unit="dias úteis"
                size="compact"
                variant={projectMetrics.remainingWorkingDays <= 7 ? "warning" : "default"}
              />

              {/* Previsto / Realizado */}
              <KPIStatCard
                icon={TrendingUp}
                label="Realizado"
                value={`${projectMetrics.actualProgress}%`}
                size="compact"
                variant={projectMetrics.isOnTrack ? "success" : "warning"}
                className="hidden xl:flex"
              />
            </div>

            {/* Milestone Dates Row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
              <KPIStatCard
                icon={Calendar}
                label="Briefing Arquitetura"
                value="—"
                size="compact"
              />
              <KPIStatCard
                icon={Calendar}
                label="Aprov. Projeto 3D"
                value="—"
                size="compact"
              />
              <KPIStatCard
                icon={Calendar}
                label="Aprov. Proj. Executivo"
                value="—"
                size="compact"
              />
              <KPIStatCard
                icon={Calendar}
                label="Aprovação da Obra"
                value="—"
                size="compact"
              />
              <KPIStatCard
                icon={Calendar}
                label="Início oficial"
                value={formatDateFull(startDate)}
                size="compact"
              />
              <KPIStatCard
                icon={CheckCircle2}
                label="Entrega oficial"
                value={formatDateFull(effectiveEndDate)}
                size="compact"
                onClick={endDate === dateChangeInfo.originalDate ? () => setShowDateChangeAlert(true) : undefined}
                variant={endDate === dateChangeInfo.originalDate ? "warning" : "default"}
                badge={
                  endDate === dateChangeInfo.originalDate ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-warning bg-warning/15 px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Alterado
                    </span>
                  ) : undefined
                }
                tooltip={endDate === dateChangeInfo.originalDate ? "Clique para ver detalhes da alteração de prazo" : undefined}
              />
            </div>

            {/* Progress Bars */}
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

        {/* Quick Links + Team Contacts */}
        <div className="px-5 py-3 border-t border-border">
          <div className="flex items-center justify-between gap-4">
            {/* Team Contacts */}
            <nav className="flex items-center gap-2" aria-label="Equipe do projeto">
              {teamContacts.map((contact) => (
                <TeamContactPopover
                  key={contact.role}
                  role={contact.role}
                  name={contact.name}
                  phone={contact.phone}
                  email={contact.email}
                  crea={contact.crea}
                  photoUrl={contact.photo_url}
                  isStaff={isStaff}
                  onEdit={() => handleEditContact(contact.role)}
                />
              ))}
            </nav>

            {/* Quick Links */}
            <nav className="flex items-center gap-2" aria-label="Ações rápidas">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    link.highlight
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                      : 'bg-card text-foreground border border-border hover:border-primary/40 hover:text-primary hover:shadow-sm'
                  }`}
                  aria-label={`Acessar ${link.label}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.highlight && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-foreground" />
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ============== MOBILE LAYOUT ============== */}
      <div className="md:hidden">
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
            <StatusBadge
              isOnTrack={projectMetrics.isOnTrack}
              progressDiff={projectMetrics.progressDiff}
              variancePercentage={projectMetrics.variancePercentage}
              isProjectPhase={isProjectPhase}
              isStaff={isStaff}
              size="sm"
            />
          </div>

          <Link
            to="/pendencias"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors border ${
              pendenciasStats.overdueCount > 0
                ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20'
                : pendenciasStats.urgentCount > 0
                  ? 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20'
                  : 'bg-secondary text-muted-foreground border-border hover:bg-accent'
            }`}
            aria-label={`${pendenciasStats.total} pendências`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Pendências</span>
            <Badge
              variant={pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"}
              className={`min-w-4 h-4 px-1 text-[10px] font-bold ${
                pendenciasStats.overdueCount > 0
                  ? ''
                  : pendenciasStats.urgentCount > 0
                    ? 'bg-warning text-warning-foreground'
                    : 'bg-muted-foreground text-white'
              }`}
            >
              {pendenciasStats.total}
            </Badge>
          </Link>
        </div>

        {/* Project Info + Metrics */}
        <div className="p-3 border-b border-border">
          <div className="flex items-start justify-between gap-2 mb-3">
            {/* Project Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-md px-1.5 py-1 -ml-1.5 transition-colors group min-w-0">
                  <div className="min-w-0">
                    <h1 className="text-[15px] font-bold leading-tight group-hover:text-primary transition-colors">
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

            {/* Dates */}
            {showMetrics && (
              <button
                onClick={() => endDate === dateChangeInfo.originalDate && setShowDateChangeAlert(true)}
                className="text-right shrink-0 flex items-center gap-1.5"
                aria-label="Datas do projeto"
              >
                <p className="text-[11px] text-muted-foreground tabular-nums">{formatDateFull(startDate)} → {formatDateFull(effectiveEndDate)}</p>
                {endDate === dateChangeInfo.originalDate && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-warning/20">
                    <AlertCircle className="w-3 h-3 text-warning" />
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Timeline Progress */}
          {showMetrics && (
            <>
              <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {projectMetrics.elapsedWorkingDays}/{projectMetrics.totalWorkingDays} dias úteis
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    Restam {projectMetrics.remainingWorkingDays}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={projectMetrics.elapsedWorkingDays} aria-valuemax={projectMetrics.totalWorkingDays}>
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                    style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current Activity + Work Progress */}
              <div className="bg-secondary/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ActivityIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">Etapa Atual</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="text-xs font-semibold text-foreground line-clamp-1 cursor-default leading-tight">
                        {projectMetrics.currentActivity}
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px]">
                      <p>{projectMetrics.currentActivity}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {projectMetrics.completedActivities}/{projectMetrics.totalActivities}
                  </span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={projectMetrics.actualProgress} aria-valuemax={100}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        projectMetrics.isOnTrack ? 'bg-success' : 'bg-warning'
                      }`}
                      style={{ width: `${projectMetrics.actualProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{projectMetrics.actualProgress}%</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Links Grid */}
        <div className="px-3 py-2.5 border-b border-border bg-secondary/15">
          <div className="grid grid-cols-4 gap-1.5">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl shadow-sm active:scale-95 transition-all min-h-[60px] ${
                  link.highlight
                    ? 'bg-primary/10 border-2 border-primary/50 ring-2 ring-primary/20'
                    : 'bg-card border border-border hover:border-primary/50 hover:shadow-md'
                }`}
                aria-label={`Acessar ${link.label}`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                  link.highlight ? 'bg-primary text-primary-foreground' : 'bg-primary/12 text-primary'
                }`}>
                  <link.icon className="w-4 h-4" />
                  {link.highlight && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground/60 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-foreground" />
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-semibold leading-tight text-center ${
                  link.highlight ? 'text-primary' : 'text-foreground'
                }`}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Team Contacts */}
        <div className="px-3 py-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {teamContacts.map((contact) => (
              <button
                key={contact.role}
                onClick={() => toggleContact(contact.role)}
                className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl transition-all min-h-[72px] ${
                  expandedContact === contact.role
                    ? 'bg-primary/10 border border-primary/30 shadow-sm'
                    : 'bg-secondary/30 hover:bg-accent/50 border border-transparent'
                }`}
                aria-expanded={expandedContact === contact.role}
                aria-label={`Ver contato de ${contact.name}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={contact.photo_url} alt={contact.name} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                    <User className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-[9px] font-semibold text-foreground text-center leading-tight">
                  {contact.role}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
              </button>
            ))}
          </div>

          {teamContacts.map((contact) => (
            expandedContact === contact.role && (
              <div key={`expanded-${contact.role}`} className="mt-2 bg-card border border-border rounded-xl p-3 animate-fade-in">
                <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-border">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.photo_url} alt={contact.name} />
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                    <p className="text-[11px] text-muted-foreground">{contact.role}</p>
                  </div>
                  {isStaff && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditContact(contact.role);
                      }}
                      aria-label={`Editar ${contact.role}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-[12px] text-primary hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-2 text-[12px] text-primary hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{contact.phone}</span>
                    </a>
                  )}
                  {contact.crea && (
                    <span className="text-[11px] text-muted-foreground">
                      CREA: {contact.crea}
                    </span>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
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
