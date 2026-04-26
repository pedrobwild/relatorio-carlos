import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProjectSwitcherSheet } from "@/components/mobile/ProjectSwitcherSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateShort, type ProjectMetrics, type MilestoneItem, type MilestoneKey } from "./types";
import { MilestonesBar } from "./ProjectStateSection";
import { ProgressSection } from "./ProgressSection";
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
  otherProjects, pendenciasStats: _pendenciasStats, pendenciasPath: _pendenciasPath, onGoBack: _onGoBack, onProjectSwitch,
  showMetrics, metrics, displayStartDate, displayEndDate,
  milestoneItems, canEditMilestones, onMilestoneDateChange,
  isStaff, hasActivities, cronogramaPath, isProjectPhase, activities, startDate, effectiveEndDate,
}: MobileReportHeaderProps) {
  const addressParts = [address, bairro, cep].filter(Boolean);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const progressPct = metrics.totalWorkingDays > 0
    ? Math.round((metrics.elapsedWorkingDays / metrics.totalWorkingDays) * 100)
    : 0;

  return (
    <div className="md:hidden">
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Project name + compact progress.
         * Back button, BWild logo and Pendências bell now live in the slim
         * `MobileObraHeader` rendered by ProjectShell — kept off this card to
         * avoid duplication. */}
        <div className="p-3">
          <div className="mb-2">
            <ProjectSwitcherSheet
              currentProjectName={projectName}
              unitName={unitName}
              clientName={clientName}
              otherProjects={otherProjects}
              onProjectSwitch={onProjectSwitch}
            />
          </div>

          {/* Compact progress summary — always visible */}
          {showMetrics && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">{metrics.currentActivity}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium tabular-nums shrink-0">
                  {metrics.completedActivities}/{metrics.totalActivities}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">{progressPct}%</span>
              </div>

              {/* Expandable details */}
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-primary font-medium w-full justify-center py-1 hover:bg-primary/5 rounded-md transition-colors min-h-[36px]">
                    {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {/* Address */}
                  {addressParts.length > 0 && (
                    <p className="text-xs text-muted-foreground">{addressParts.join(' · ')}</p>
                  )}

                  {/* Dates */}
                  <div className="flex items-center justify-between gap-3 px-1">
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

                  {/* Milestones */}
                  <MilestonesBar milestoneItems={milestoneItems} canEdit={canEditMilestones} isMobile onMilestoneDateChange={onMilestoneDateChange} />

                  {/* Day counter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-meta tabular-nums">{metrics.elapsedWorkingDays}/{metrics.totalWorkingDays} dias úteis</span>
                      <span className="text-meta tabular-nums">Restam {metrics.remainingWorkingDays}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>

      {/* Detailed progress — only when expanded */}
      {showMetrics && detailsOpen && (
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
