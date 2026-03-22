import { Link } from "react-router-dom";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { ArrowLeft, Bell, Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDateShort } from "./types";
import { MilestonesBar } from "./ProjectStateSection";
import { ProgressSection } from "./ProgressSection";
import type { ProjectMetrics, MilestoneItem, MilestoneKey } from "./types";
import type { ProjectWithCustomer } from "@/infra/repositories";
import type { Activity } from "@/types/report";

interface MobileReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  address?: string;
  bairro?: string;
  cep?: string;
  otherProjects: ProjectWithCustomer[];
  pendenciasStats: { total: number; overdueCount: number; urgentCount: number };
  pendenciasPath: string;
  onGoBack: () => void;
  onProjectSwitch: (id: string) => void;
  showMetrics: boolean;
  metrics: ProjectMetrics;
  displayStartDate: string | null;
  displayEndDate: string | null;
  milestoneItems: MilestoneItem[];
  canEditMilestones: boolean;
  onMilestoneDateChange?: (key: MilestoneKey, date: string | null) => Promise<void>;
  isStaff: boolean;
  hasActivities: boolean;
  cronogramaPath: string;
  isProjectPhase: boolean;
  activities: Activity[];
  startDate: string | null;
  effectiveEndDate: string | null;
}

export function MobileReportHeader({
  projectName, unitName, clientName, address, bairro, cep,
  otherProjects, pendenciasStats, pendenciasPath, onGoBack, onProjectSwitch,
  showMetrics, metrics, displayStartDate, displayEndDate,
  milestoneItems, canEditMilestones, onMilestoneDateChange,
  isStaff, hasActivities, cronogramaPath, isProjectPhase, activities, startDate, effectiveEndDate,
}: MobileReportHeaderProps) {
  const addressParts = [address, bairro, cep].filter(Boolean);

  return (
    <div className="md:hidden">
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onGoBack} className="h-8 w-8 rounded-full" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={bwildLogo} alt="Bwild" className="h-7 w-auto" />
          </div>
          <Link
            to={pendenciasPath}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all border active:scale-[0.97]",
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
                pendenciasStats.overdueCount > 0 ? '' : pendenciasStats.urgentCount > 0 ? 'bg-warning text-warning-foreground' : 'bg-muted-foreground text-white'
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
                    {clientName && <p className="text-caption mt-0.5">Cliente: {clientName}</p>}
                    {addressParts.length > 0 && <p className="text-xs text-muted-foreground truncate">{addressParts.join(' · ')}</p>}
                  </div>
                  {otherProjects.length > 0 && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                </button>
              </DropdownMenuTrigger>
              {otherProjects.length > 0 && (
                <DropdownMenuContent align="start" className="w-64 bg-popover">
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs"><Building2 className="h-3.5 w-3.5" />Trocar de Obra</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {otherProjects.map((project) => (
                    <DropdownMenuItem key={project.id} onClick={() => onProjectSwitch(project.id)} className="flex flex-col items-start gap-0.5 cursor-pointer">
                      <span className="font-medium text-sm">{project.name} {project.unit_name && `– ${project.unit_name}`}</span>
                      {project.customer_name && <span className="text-xs text-muted-foreground">Cliente: {project.customer_name}</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          </div>

          {showMetrics && (
            <>
              <div className="bg-muted/40 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-meta font-semibold uppercase tracking-wider">Etapa Atual</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium tabular-nums">
                    {metrics.completedActivities}/{metrics.totalActivities}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug break-words">{metrics.currentActivity}</p>
              </div>

              <div className="flex items-center justify-between gap-3 mb-3 px-1">
                <div>
                  <span className="text-meta font-semibold uppercase tracking-wider block mb-0.5">Início</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{displayStartDate ? formatDateShort(displayStartDate) : '—'}</span>
                </div>
                <div className="flex-1 h-px bg-border mx-2" />
                <div className="text-right">
                  <span className="text-meta font-semibold uppercase tracking-wider block mb-0.5">Entrega</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">{displayEndDate ? formatDateShort(displayEndDate) : '—'}</span>
                </div>
              </div>

              <MilestonesBar milestoneItems={milestoneItems} canEdit={canEditMilestones} isMobile onMilestoneDateChange={onMilestoneDateChange} />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-meta tabular-nums">{metrics.elapsedWorkingDays}/{metrics.totalWorkingDays} dias úteis</span>
                  <span className="text-meta tabular-nums">Restam {metrics.remainingWorkingDays}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={metrics.elapsedWorkingDays} aria-valuemax={metrics.totalWorkingDays}>
                  <div className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out" style={{ width: `${(metrics.elapsedWorkingDays / metrics.totalWorkingDays) * 100}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showMetrics && (
        <div className="mt-2 bg-card rounded-xl border border-border shadow-sm p-3">
          <ProgressSection
            elapsedWorkingDays={metrics.elapsedWorkingDays}
            totalWorkingDays={metrics.totalWorkingDays}
            remainingWorkingDays={metrics.remainingWorkingDays}
            actualProgress={metrics.actualProgress}
            plannedProgress={metrics.plannedProgress}
            isOnTrack={metrics.isOnTrack}
            isStaff={isStaff}
            hasActivities={hasActivities}
            cronogramaPath={cronogramaPath}
            isProjectPhase={isProjectPhase}
            activities={activities}
            projectStartDate={startDate ?? undefined}
            projectEndDate={effectiveEndDate ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
