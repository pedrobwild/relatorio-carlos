import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo.png";
import { 
  FileText, Box, Ruler, DollarSign, ClipboardSignature, User, Phone, Mail, 
  ChevronDown, Calendar, Clock, CheckCircle2, AlertTriangle, Activity as ActivityIcon,
  TrendingUp, TrendingDown, ExternalLink, Bell, AlertCircle, FolderOpen, Pencil, ArrowLeft, Map,
  ChevronsUpDown, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Activity } from "@/types/report";
import { usePendencias } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useTeamContacts, TeamContact as TeamContactData } from "@/hooks/useTeamContacts";
import { TeamContactEditModal } from "@/components/TeamContactEditModal";
import { TeamContactPopover } from "@/components/TeamContactPopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    
    // Dias decorridos e restantes só são calculados a partir da data de início oficial
    const hasStarted = today >= start;
    const elapsedWorkingDays = hasStarted ? calculateWorkingDays(start, today) : 0;
    // Calculate remaining from today (if started) or full duration (if not started)
    const remainingWorkingDays = !hasStarted 
      ? totalWorkingDays 
      : (today < end ? calculateWorkingDays(today, end) : 0);

    // Check if any activity has weight defined
    const hasWeights = activities.some(a => (a as any).weight !== undefined);
    
    // Calculate total weight (should be 100, but normalize if not)
    const totalWeight = hasWeights 
      ? activities.reduce((sum, a) => sum + ((a as any).weight || 0), 0)
      : activities.length;

    // Calculate completion based on activities using weights
    const completedWeight = activities.reduce((sum, a) => {
      if (a.actualEnd) {
        return sum + (hasWeights ? ((a as any).weight || 0) : 1);
      }
      return sum;
    }, 0);
    const completedActivities = activities.filter(a => a.actualEnd).length;
    const totalActivities = activities.length;
    const actualProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;

    // Calculate planned progress (what should be done by reportDate) using weights
    const plannedWeight = activities.reduce((sum, a) => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      if (plannedEnd <= report) {
        return sum + (hasWeights ? ((a as any).weight || 0) : 1);
      }
      return sum;
    }, 0);
    const plannedProgress = totalWeight > 0 ? (plannedWeight / totalWeight) * 100 : 0;

    // Determine status
    const progressDiff = actualProgress - plannedProgress;
    const isOnTrack = progressDiff >= 0;
    const variancePercentage = Math.abs(progressDiff).toFixed(0);

    // Current activity (first activity that's in progress on report date)
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
  
  // Team contacts from database
  const { 
    contacts: dbContacts, 
    upsertContact, 
    isUpserting, 
    uploadPhoto, 
    isUploading,
    roleLabels 
  } = useTeamContacts(projectId);

  // Filter out current project and get other available projects
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

  // Map database contacts to legacy format for display
  const teamContacts: LegacyTeamContact[] = useMemo(() => {
    const mapped = dbContacts.map(c => ({
      role: roleLabels[c.role_type] || c.role_type,
      name: c.display_name,
      phone: c.phone || '',
      email: c.email || '',
      crea: c.crea || undefined,
      photo_url: c.photo_url || undefined,
    }));
    
    // Filter for project phase
    return isProjectPhase && !isStaff
      ? mapped.filter(c => c.role !== 'Engenharia')
      : mapped;
  }, [dbContacts, isProjectPhase, isStaff, roleLabels]);
  
  // Get the database contact for editing
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

  const { stats: pendenciasStats } = usePendencias();

  return (
    <header className="bg-card rounded-xl border border-border mb-3 md:mb-4 animate-fade-in">
      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* Top Section: Project Info + Status */}
        <div className="p-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-4">
            {/* Left: Back Button + Logo + Project */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  // BUG FIX: Previne loop se histórico estiver vazio
                  // Se veio de outra página, volta. Senão, vai para o dashboard correto.
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
                  }
                }}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
              <div className="h-8 w-px bg-border" />
              
              {/* Project Selector Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-2 py-1 transition-colors group">
                    <div>
                      <h1 className="text-h3 leading-tight group-hover:text-primary transition-colors">
                        {projectName} – {unitName}
                      </h1>
                      {clientName && (
                        <p className="text-tiny text-muted-foreground">Cliente: {clientName}</p>
                      )}
                    </div>
                    {otherProjects.length > 0 && (
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                {otherProjects.length > 0 && (
                  <DropdownMenuContent align="start" className="w-72">
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

            {/* Right: CTA + Status Badge */}
            <div className="flex items-center gap-3">
              {/* Pendências CTA */}
              <Link
                to={paths.pendencias}
                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors font-semibold text-sm ${
                  pendenciasStats.overdueCount > 0 
                    ? 'bg-destructive/15 text-destructive hover:bg-destructive/25' 
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning/15 text-warning hover:bg-warning/25'
                      : 'bg-secondary text-muted-foreground hover:bg-accent'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Pendências</span>
                <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-white text-xs font-bold ${
                  pendenciasStats.overdueCount > 0 
                    ? 'bg-destructive' 
                    : pendenciasStats.urgentCount > 0
                      ? 'bg-warning'
                      : 'bg-muted-foreground'
                }`}>
                  {pendenciasStats.total}
                </span>
              </Link>

              {/* Status Badge - Oculto em fase de projeto para clientes */}
              {!(isProjectPhase && !isStaff) && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
                  projectMetrics.isOnTrack 
                    ? 'bg-success/15 text-success' 
                    : 'bg-warning/15 text-warning'
                }`}>
                  {projectMetrics.isOnTrack ? (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      <span>No Prazo</span>
                      {projectMetrics.progressDiff > 0 && (
                        <span className="text-xs opacity-80">+{projectMetrics.variancePercentage}%</span>
                      )}
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4" />
                      <span>Atenção ao Prazo</span>
                      {parseInt(projectMetrics.variancePercentage) > 0 && (
                        <span className="text-xs opacity-80">-{projectMetrics.variancePercentage}%</span>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* Badge de Fase de Projeto para clientes */}
              {isProjectPhase && !isStaff && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm bg-primary/15 text-primary">
                  <FileText className="w-4 h-4" />
                  <span>Fase de Projeto</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Metrics Section */}
        <div className={`p-4 pb-3 bg-secondary/20 ${isProjectPhase && !isStaff ? 'hidden' : ''}`}>
          <div className="grid grid-cols-6 xl:grid-cols-8 gap-4">
            {/* Current Activity - Spans 2 columns on md, 3 on xl */}
            <div className="col-span-2 xl:col-span-3 bg-card rounded-lg p-3 border border-border">
              <div className="text-caption uppercase tracking-wide mb-1.5 flex items-center gap-2">
                <ActivityIcon className="w-3.5 h-3.5" />
                Etapa Atual
              </div>
              <p className="text-h3 line-clamp-2">
                {projectMetrics.currentActivity}
              </p>
              <p className="text-caption mt-1">
                {projectMetrics.completedActivities} de {projectMetrics.totalActivities} etapas concluídas
              </p>
            </div>

            {/* Start Date */}
            <div className="bg-card rounded-lg p-3 border border-border flex flex-col">
              <div className="text-caption uppercase tracking-wide mb-auto flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Início</span>
              </div>
              <p className="text-h3 mt-2">{formatDateFull(startDate)}</p>
            </div>

            {/* End Date */}
            <button 
              onClick={() => endDate === dateChangeInfo.originalDate && setShowDateChangeAlert(true)}
              className={`bg-card rounded-lg p-3 border text-left transition-all flex flex-col ${
                endDate === dateChangeInfo.originalDate 
                  ? 'border-warning/50 hover:border-warning cursor-pointer' 
                  : 'border-border cursor-default'
              }`}
            >
              <div className="text-caption uppercase tracking-wide mb-auto flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Previsão</span>
                {endDate === dateChangeInfo.originalDate && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-warning bg-warning/15 px-1.5 py-0.5 rounded-full font-semibold ml-auto">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Alterado
                  </span>
                )}
              </div>
              <p className="text-h3 mt-2">{formatDateFull(effectiveEndDate)}</p>
            </button>

            {/* Total Working Days */}
            <div className="bg-card rounded-lg p-3 border border-border flex flex-col">
              <div className="text-caption uppercase tracking-wide mb-auto flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Duração</span>
              </div>
              <p className="text-h3 mt-2">
                <span>{projectMetrics.totalWorkingDays}</span>
                <span className="text-caption font-normal ml-1">dias úteis</span>
              </p>
            </div>

            {/* Remaining Working Days */}
            <div className={`rounded-lg p-3 border flex flex-col ${
              projectMetrics.remainingWorkingDays <= 7 
                ? 'bg-warning/10 border-warning/30' 
                : 'bg-card border-border'
            }`}>
              <div className="text-caption uppercase tracking-wide mb-auto flex items-center gap-1.5">
                {projectMetrics.remainingWorkingDays <= 7 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span>Restante</span>
              </div>
              <p className={`text-h3 mt-2 ${
                projectMetrics.remainingWorkingDays <= 7 
                  ? 'text-warning' 
                  : ''
              }`}>
                <span>{projectMetrics.remainingWorkingDays}</span>
                <span className="text-caption font-normal ml-1">dias úteis</span>
              </p>
            </div>

            {/* Extra metrics for wider screens */}
            <div className="hidden xl:flex xl:col-span-2 items-center gap-4">
              {/* Planned Progress */}
              <div className="flex-1 bg-card rounded-lg p-3 border border-border">
                <div className="text-caption uppercase tracking-wide mb-1.5">Previsto</div>
                <p className="text-h3">{projectMetrics.plannedProgress}%</p>
              </div>
              {/* Actual Progress */}
              <div className={`flex-1 rounded-lg p-3 border ${
                projectMetrics.isOnTrack 
                  ? 'bg-success/10 border-success/30' 
                  : 'bg-warning/10 border-warning/30'
              }`}>
                <div className="text-caption uppercase tracking-wide mb-1.5">Realizado</div>
                <p className={`text-h3 ${
                  projectMetrics.isOnTrack ? 'text-success' : 'text-warning'
                }`}>{projectMetrics.actualProgress}%</p>
              </div>
            </div>
          </div>

          {/* Progress Bars - Side by side on xl */}
          <div className={`mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4 ${isProjectPhase && !isStaff ? 'hidden' : ''}`}>
            {/* Timeline Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-h3">Cronograma</h3>
                  {isStaff && activities.length > 0 && (
                    <Link 
                      to={paths.cronograma} 
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Editar cronograma"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
                <span className="text-caption">
                  {projectMetrics.elapsedWorkingDays} de {projectMetrics.totalWorkingDays} dias úteis
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
                <div 
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
                />
              </div>
              <p className="flex items-center justify-between text-tiny mt-1">
                <span>Decorridos: {projectMetrics.elapsedWorkingDays} dias</span>
                <span>Restantes: {projectMetrics.remainingWorkingDays} dias</span>
              </p>
            </div>

            {/* Work Progress Bar */}
            <div className="xl:hidden">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-h3">Progresso da Obra</h3>
                <span className="text-h3">{projectMetrics.actualProgress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    projectMetrics.isOnTrack 
                      ? 'bg-success' 
                      : 'bg-warning'
                  }`}
                  style={{ width: `${projectMetrics.actualProgress}%` }}
                />
              </div>
              <p className="flex items-center justify-between text-tiny mt-1">
                <span>Previsto até hoje: {projectMetrics.plannedProgress}%</span>
                <span>Realizado: {projectMetrics.actualProgress}%</span>
              </p>
            </div>

            {/* Comparative Progress Bar - XL only */}
            <div className="hidden xl:block">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-h3">Progresso da Obra</h3>
                <div className="flex items-center gap-4 text-caption">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                    Previsto: {projectMetrics.plannedProgress}%
                  </span>
                  <span className={`flex items-center gap-1.5 font-semibold ${
                    projectMetrics.isOnTrack ? 'text-success' : 'text-warning'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      projectMetrics.isOnTrack ? 'bg-success' : 'bg-warning'
                    }`}></span>
                    Realizado: {projectMetrics.actualProgress}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
                {/* Planned line */}
                <div 
                  className="absolute top-0 h-full bg-primary/30 rounded-full"
                  style={{ width: `${projectMetrics.plannedProgress}%` }}
                />
                {/* Actual progress */}
                <div 
                  className={`absolute top-0 h-full rounded-full transition-all duration-500 ${
                    projectMetrics.isOnTrack ? 'bg-success' : 'bg-warning'
                  }`}
                  style={{ width: `${projectMetrics.actualProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links + Team Contacts */}
        <div className="p-4 pt-3">
          <div className="flex items-center justify-between gap-4">
            {/* Team Contacts */}
            <div className="flex items-center gap-4">
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
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    link.highlight 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' 
                      : 'bg-card text-foreground border border-border hover:border-primary hover:text-primary shadow-sm'
                  }`}
                  aria-label={`Acessar ${link.label}`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                  {link.highlight && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Status Banner + Pendências CTA */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
          {/* Back Button + Status */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // BUG FIX: Previne loop se histórico estiver vazio
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
                }
              }}
              className="h-7 w-7"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Status - Oculto em fase de projeto para clientes */}
            {isProjectPhase && !isStaff ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/15">
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">Fase de Projeto</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                projectMetrics.isOnTrack 
                  ? 'bg-success/15' 
                  : 'bg-warning/15'
              }`}>
                {projectMetrics.isOnTrack ? (
                  <TrendingUp className="w-3.5 h-3.5 text-success" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-warning" />
                )}
                <span className={`text-xs font-semibold ${
                  projectMetrics.isOnTrack ? 'text-success' : 'text-warning'
                }`}>
                  {projectMetrics.isOnTrack ? 'No Prazo' : 'Atenção'}
                </span>
                {projectMetrics.progressDiff !== 0 && (
                  <span className={`text-[10px] font-bold ${
                    projectMetrics.isOnTrack ? 'text-success' : 'text-warning'
                  }`}>
                    {projectMetrics.progressDiff >= 0 ? '+' : ''}{projectMetrics.progressDiff}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pendências CTA */}
          <Link
            to="/pendencias"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
              pendenciasStats.overdueCount > 0 
                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25' 
                : pendenciasStats.urgentCount > 0
                  ? 'bg-warning/15 text-warning hover:bg-warning/25'
                  : 'bg-secondary text-muted-foreground hover:bg-accent'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Pendências</span>
            <span className={`flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-white text-[10px] font-bold ${
              pendenciasStats.overdueCount > 0 
                ? 'bg-destructive' 
                : pendenciasStats.urgentCount > 0
                  ? 'bg-warning'
                  : 'bg-muted-foreground'
            }`}>
              {pendenciasStats.total}
            </span>
          </Link>
        </div>

        {/* Project Info + Schedule Metrics - Unified Card */}
        <div className="p-3 border-b border-border">
          {/* Project Header with Dates */}
          <div className="flex items-start justify-between gap-2 mb-3">
            {/* Project Selector for Mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-md px-1.5 py-1 -ml-1.5 transition-colors group">
                  <div>
                    <h1 className="text-body font-semibold leading-tight group-hover:text-primary transition-colors">
                      {projectName} – {unitName}
                    </h1>
                    {clientName && (
                      <p className="text-tiny text-muted-foreground">Cliente: {clientName}</p>
                    )}
                  </div>
                  {otherProjects.length > 0 && (
                    <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  )}
                </button>
              </DropdownMenuTrigger>
              {otherProjects.length > 0 && (
                <DropdownMenuContent align="start" className="w-64">
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
            {/* Datas - Ocultas em fase de projeto */}
            {!(isProjectPhase && !isStaff) && (
              <button 
                onClick={() => endDate === dateChangeInfo.originalDate && setShowDateChangeAlert(true)}
                className="text-right shrink-0 flex items-center gap-1.5"
              >
                <p className="text-tiny">{formatDateFull(startDate)} → {formatDateFull(effectiveEndDate)}</p>
                {endDate === dateChangeInfo.originalDate && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-warning/20">
                    <AlertCircle className="w-3 h-3 text-warning" />
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Timeline Progress Bar - First */}
          <div className={`mb-2 ${isProjectPhase && !isStaff ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-tiny">
                {projectMetrics.elapsedWorkingDays}/{projectMetrics.totalWorkingDays} dias úteis
              </span>
              <span className="text-tiny">
                Restam {projectMetrics.remainingWorkingDays}
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
              />
            </div>
          </div>

          {/* Current Activity + Progress - Second */}
          <div className={`bg-secondary/30 rounded-lg p-2 ${isProjectPhase && !isStaff ? 'hidden' : ''}`}>
            <h3 className="text-xs text-foreground line-clamp-1">
              {projectMetrics.currentActivity}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-tiny">
                {projectMetrics.completedActivities}/{projectMetrics.totalActivities}
              </span>
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    projectMetrics.isOnTrack ? 'bg-success' : 'bg-warning'
                  }`}
                  style={{ width: `${projectMetrics.actualProgress}%` }}
                />
              </div>
              <span className="text-tiny font-bold text-foreground">{projectMetrics.actualProgress}%</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="px-2.5 py-2.5 border-b border-border bg-secondary/20">
          <div className="grid grid-cols-6 gap-1">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl shadow-sm active:scale-95 transition-all ${
                  link.highlight 
                    ? 'bg-primary/10 border-2 border-primary/50 ring-2 ring-primary/20' 
                    : 'bg-card border border-border hover:border-primary/50 hover:shadow-md'
                }`}
                aria-label={`Acessar ${link.label}`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                  link.highlight ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
                }`}>
                  <link.icon className="w-4 h-4" />
                  {link.highlight && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-foreground/60 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-foreground"></span>
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-semibold leading-tight text-center ${
                  link.highlight ? 'text-primary' : 'text-foreground'
                }`}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Team Contacts - Grid Layout */}
        <div className="px-2.5 py-2">
          <div className="grid grid-cols-3 gap-1.5">
            {teamContacts.map((contact) => (
              <button
                key={contact.role}
                onClick={() => toggleContact(contact.role)}
                className={`flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg transition-all ${
                  expandedContact === contact.role 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'bg-secondary/30 hover:bg-accent/50'
                }`}
                aria-label={`Ver contato de ${contact.name}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={contact.photo_url} alt={contact.name} />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    <User className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-[9px] font-medium text-foreground text-center leading-tight">
                  {contact.role}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
              </button>
            ))}
          </div>
          
          {teamContacts.map((contact) => (
            expandedContact === contact.role && (
              <div key={`expanded-${contact.role}`} className="mt-2 bg-card border border-border rounded-lg p-2.5 animate-fade-in">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.photo_url} alt={contact.name} />
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-tiny font-semibold text-foreground">{contact.name}</p>
                    <p className="text-tiny text-muted-foreground">{contact.role}</p>
                  </div>
                  {isStaff && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
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
                <div className="flex flex-col gap-1.5">
                  {contact.email && (
                    <a 
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-tiny text-primary hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      <span>{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a 
                      href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-2 text-tiny text-primary hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{contact.phone}</span>
                    </a>
                  )}
                  {contact.crea && (
                    <span className="text-tiny text-muted-foreground">
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
