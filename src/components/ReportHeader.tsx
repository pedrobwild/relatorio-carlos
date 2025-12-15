import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo.png";
import { 
  FileText, Box, Ruler, DollarSign, Headphones, User, Phone, Mail, 
  ChevronDown, Calendar, Clock, CheckCircle2, AlertTriangle, Activity as ActivityIcon,
  TrendingUp, TrendingDown
} from "lucide-react";
import { Activity } from "@/types/report";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  reportDate: string;
  activities: Activity[];
}

interface TeamContact {
  role: string;
  name: string;
  phone: string;
  email: string;
  crea?: string;
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
}: ReportHeaderProps) => {
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const report = new Date(reportDate + "T00:00:00");

    const totalWorkingDays = calculateWorkingDays(start, end);
    const elapsedWorkingDays = calculateWorkingDays(start, report);
    const remainingWorkingDays = calculateWorkingDays(report, end);

    // Calculate completion based on activities
    const completedActivities = activities.filter(a => a.actualEnd).length;
    const totalActivities = activities.length;
    const actualProgress = totalActivities > 0 ? (completedActivities / totalActivities) * 100 : 0;

    // Calculate planned progress (what should be done by reportDate)
    const plannedCompletedByNow = activities.filter(a => {
      const plannedEnd = new Date(a.plannedEnd + "T00:00:00");
      return plannedEnd <= report;
    }).length;
    const plannedProgress = totalActivities > 0 ? (plannedCompletedByNow / totalActivities) * 100 : 0;

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
  }, [startDate, endDate, reportDate, activities]);

  const quickLinks = [
    { icon: FileText, label: "Contrato", href: "/contrato" },
    { icon: Box, label: "Projeto 3D", href: "/projeto-3d" },
    { icon: Ruler, label: "Executivo", href: "/executivo" },
    { icon: DollarSign, label: "Financeiro", href: "/financeiro" },
    { icon: Headphones, label: "Suporte", href: "/suporte" },
  ];

  const teamContacts: TeamContact[] = [
    { role: "Engenheiro", name: "Lucas Tresmondi", phone: "(99) 99999-9999", email: "lucas@bwild.com.br", crea: "5071459470-SP" },
    { role: "Arquiteta", name: "Lorena Alves", phone: "(99) 99999-9999", email: "lorena@bwild.com.br" },
    { role: "Gerente de Relacionamento", name: "Victorya Capponi", phone: "(99) 99999-9999", email: "victorya@bwild.com.br" },
  ];

  const toggleContact = (role: string) => {
    setExpandedContact(expandedContact === role ? null : role);
  };

  return (
    <header className="bg-card rounded-xl border border-border overflow-hidden mb-3 md:mb-4 animate-fade-in">
      {/* Desktop Layout */}
      <div className="hidden md:block">
        {/* Top Section: Project Info + Status */}
        <div className="p-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            {/* Left: Logo + Project */}
            <div className="flex items-center gap-3">
              <img src={bwildLogo} alt="Bwild" className="h-8 w-auto" />
              <div className="h-8 w-px bg-border" />
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">
                  {projectName} – {unitName}
                </h1>
                {clientName && (
                  <p className="text-sm text-muted-foreground">Cliente: {clientName}</p>
                )}
              </div>
            </div>

            {/* Right: Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
              projectMetrics.isOnTrack 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
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
          </div>
        </div>

        {/* Main Metrics Section */}
        <div className="p-4 pb-3 bg-secondary/20">
          <div className="grid grid-cols-6 gap-4">
            {/* Current Activity - Spans 2 columns */}
            <div className="col-span-2 bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                <ActivityIcon className="w-3.5 h-3.5" />
                Etapa Atual
              </div>
              <p className="text-sm font-semibold text-foreground line-clamp-2">
                {projectMetrics.currentActivity}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {projectMetrics.completedActivities} de {projectMetrics.totalActivities} etapas concluídas
              </p>
            </div>

            {/* Start Date */}
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Início
              </div>
              <p className="text-base font-bold text-foreground">{formatDateFull(startDate)}</p>
            </div>

            {/* End Date */}
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Previsão Término
              </div>
              <p className="text-base font-bold text-foreground">{formatDateFull(endDate)}</p>
            </div>

            {/* Total Working Days */}
            <div className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                Dias Úteis Totais
              </div>
              <p className="text-base font-bold text-foreground">{projectMetrics.totalWorkingDays} <span className="text-xs font-normal text-muted-foreground">dias</span></p>
            </div>

            {/* Remaining Working Days */}
            <div className={`rounded-lg p-3 border ${
              projectMetrics.remainingWorkingDays <= 7 
                ? 'bg-amber-500/10 border-amber-500/30' 
                : 'bg-card border-border'
            }`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {projectMetrics.remainingWorkingDays <= 7 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                Dias Restantes
              </div>
              <p className={`text-base font-bold ${
                projectMetrics.remainingWorkingDays <= 7 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-foreground'
              }`}>
                {projectMetrics.remainingWorkingDays} <span className="text-xs font-normal opacity-70">dias úteis</span>
              </p>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="mt-4 space-y-3">
            {/* Work Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-muted-foreground">Progresso da Obra</span>
                <span className="font-bold text-foreground">{projectMetrics.actualProgress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    projectMetrics.isOnTrack 
                      ? 'bg-emerald-500' 
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${projectMetrics.actualProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                <span>Previsto até hoje: {projectMetrics.plannedProgress}%</span>
                <span>Realizado: {projectMetrics.actualProgress}%</span>
              </div>
            </div>

            {/* Timeline Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-muted-foreground">Cronograma</span>
                <span className="text-xs text-muted-foreground">
                  {projectMetrics.elapsedWorkingDays} de {projectMetrics.totalWorkingDays} dias úteis
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
                <div 
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                <span>Decorridos: {projectMetrics.elapsedWorkingDays} dias</span>
                <span>Restantes: {projectMetrics.remainingWorkingDays} dias</span>
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
                <div key={contact.role} className="relative">
                  <button
                    onClick={() => toggleContact(contact.role)}
                    className="flex items-center gap-2 hover:bg-accent/50 p-1.5 rounded-lg transition-colors"
                    aria-label={`Ver contato de ${contact.name}`}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent">
                      <User className="w-3 h-3 text-accent-foreground" />
                    </div>
                    <div>
                      <span className="font-medium text-xs text-foreground">{contact.role}:</span>{" "}
                      <span className="text-xs text-muted-foreground">{contact.name}</span>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {expandedContact === contact.role && (
                    <div className="absolute top-full left-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-2.5 min-w-[200px] animate-fade-in">
                      <div className="space-y-1.5">
                        <a 
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          <span>{contact.email}</span>
                        </a>
                        <a 
                          href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{contact.phone}</span>
                        </a>
                        {contact.crea && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                            <span className="font-medium">CREA:</span>
                            <span>{contact.crea}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-1">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={`Acessar ${link.label}`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Status Banner */}
        <div className={`px-3 py-2 flex items-center justify-between ${
          projectMetrics.isOnTrack 
            ? 'bg-emerald-500/15' 
            : 'bg-amber-500/15'
        }`}>
          <div className="flex items-center gap-2">
            {projectMetrics.isOnTrack ? (
              <TrendingUp className={`w-4 h-4 ${projectMetrics.isOnTrack ? 'text-emerald-600' : 'text-amber-600'}`} />
            ) : (
              <TrendingDown className="w-4 h-4 text-amber-600" />
            )}
            <span className={`text-sm font-semibold ${
              projectMetrics.isOnTrack ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {projectMetrics.isOnTrack ? 'No Prazo' : 'Atenção ao Prazo'}
            </span>
          </div>
          {projectMetrics.progressDiff !== 0 && (
            <span className={`text-xs font-bold ${
              projectMetrics.isOnTrack ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {projectMetrics.progressDiff >= 0 ? '+' : ''}{projectMetrics.progressDiff}% vs previsto
            </span>
          )}
        </div>

        {/* Project Info */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Projeto</p>
          </div>
          <h1 className="text-base font-bold text-foreground leading-tight">
            {projectName} – {unitName}
          </h1>
          {clientName && (
            <p className="text-xs text-muted-foreground mt-0.5">Cliente: {clientName}</p>
          )}
        </div>

        {/* Quick Links - Now between Project and Current Activity */}
        <div className="p-3 border-b border-border">
          <div className="grid grid-cols-5 gap-1">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-95 transition-all"
                aria-label={`Acessar ${link.label}`}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary">
                  <link.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-medium leading-tight text-center">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Current Activity */}
        <div className="p-3 bg-secondary/30 border-b border-border">
          <p className="text-sm font-semibold text-foreground">
            {projectMetrics.currentActivity}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-muted-foreground">
              {projectMetrics.completedActivities}/{projectMetrics.totalActivities} etapas
            </span>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  projectMetrics.isOnTrack ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${projectMetrics.actualProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-foreground">{projectMetrics.actualProgress}%</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="p-3 grid grid-cols-2 gap-2 border-b border-border">
          <div className="bg-secondary/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              <Calendar className="w-3 h-3" />
              Início
            </div>
            <p className="text-sm font-bold text-foreground">{formatDateFull(startDate)}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase mb-1">
              <CheckCircle2 className="w-3 h-3" />
              Término
            </div>
            <p className="text-sm font-bold text-foreground">{formatDateFull(endDate)}</p>
          </div>
        </div>

        {/* Timeline Progress Bar - Mobile */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-muted-foreground">Cronograma</span>
            <span className="text-xs text-muted-foreground">
              {projectMetrics.elapsedWorkingDays} de {projectMetrics.totalWorkingDays} dias úteis
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary/70 transition-all duration-500"
              style={{ width: `${(projectMetrics.elapsedWorkingDays / projectMetrics.totalWorkingDays) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
            <span>Decorridos: {projectMetrics.elapsedWorkingDays} dias</span>
            <span>Restantes: {projectMetrics.remainingWorkingDays} dias</span>
          </div>
        </div>

        {/* Team Contacts */}
        <div className="p-3">
          <p className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-2">Equipe</p>
          <div className="space-y-1.5">
            {teamContacts.map((contact) => (
              <div key={contact.role}>
                <button
                  onClick={() => toggleContact(contact.role)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg bg-secondary/30 hover:bg-accent/50 active:scale-[0.99] transition-all text-left"
                  aria-label={`Ver contato de ${contact.name}`}
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{contact.role}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.name}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${expandedContact === contact.role ? 'rotate-180' : ''}`} />
                </button>
                
                {expandedContact === contact.role && (
                  <div className="mt-1 ml-9 bg-card border border-border rounded-lg p-2 animate-fade-in">
                    <div className="space-y-1">
                      <a 
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        <span>{contact.email}</span>
                      </a>
                      <a 
                        href={`tel:+55${contact.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{contact.phone}</span>
                      </a>
                      {contact.crea && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                          <span className="font-medium">CREA:</span>
                          <span>{contact.crea}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;
