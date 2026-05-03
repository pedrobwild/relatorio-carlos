import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePendencias } from "@/hooks/usePendencias";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useTeamContacts, TeamContact as TeamContactData } from "@/hooks/useTeamContacts";
import { TeamContactEditModal } from "@/components/TeamContactEditModal";
import { ProgressSection } from "@/components/header/ProgressSection";
import { IdentityBar } from "@/components/header/IdentityBar";
import { ProjectStateSection, MilestonesBar } from "@/components/header/ProjectStateSection";
import { MobileReportHeader } from "@/components/header/MobileReportHeader";
import { DateChangeAlert } from "@/components/header/DateChangeAlert";
import { useProjectMetrics, useMilestoneItems } from "@/components/header/useReportHeaderData";
import type { ReportHeaderProps, MilestoneKey } from "@/components/header/types";

// Re-export types for backward compatibility
export type { MilestoneKey } from "@/components/header/types";

const ReportHeader = ({
  projectName, unitName, clientName, startDate, endDate, reportDate, activities,
  isProjectPhase = false, milestoneDates, canEditMilestones = false, onMilestoneDateChange,
}: ReportHeaderProps) => {
  const [showDateChangeAlert, setShowDateChangeAlert] = useState(false);
  const [editingContact, setEditingContact] = useState<TeamContactData | null>(null);

  const dateChangeInfo = {
    originalDate: "2025-09-14",
    newDate: "2025-09-17",
    reason: "Atraso no pagamento da parcela de 45 dias",
    contractClause: "5.1.2",
  };

  const effectiveEndDate = endDate === dateChangeInfo.originalDate ? dateChangeInfo.newDate : endDate;

  const earliestStartFromActivities = useMemo(() => {
    const starts = activities.map(a => a.plannedStart).filter((d): d is string => !!d).sort();
    return starts[0] ?? null;
  }, [activities]);
  const effectiveStartDate = earliestStartFromActivities ?? startDate;
  const projectMetrics = useProjectMetrics(effectiveStartDate, effectiveEndDate, reportDate, activities);
  const milestoneItems = useMilestoneItems(milestoneDates);

  const { paths, projectId } = useProjectNavigation();
  const { project: currentProject } = useProject();
  const isMobile = useIsMobile();
  const { isStaff } = useUserRole();
  const { data: projects = [] } = useProjectsQuery();
  const navigate = useNavigate();

  const {
    contacts: dbContacts, upsertContact, isUpserting, uploadPhoto, isUploading, roleLabels,
  } = useTeamContacts(projectId);

  const otherProjects = useMemo(() => projects.filter(p => p.id !== projectId), [projects, projectId]);

  const handleProjectSwitch = (targetProjectId: string) => navigate(`/obra/${targetProjectId}/relatorio`);
  const handleGoBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(isStaff ? '/gestao' : '/minhas-obras', { replace: true });
  };

  const showMetrics = !(isProjectPhase && !isStaff);
  // "Início previsto" reflete a data de início da primeira atividade do cronograma.
  const displayStartDate = effectiveStartDate;
  const displayEndDate = effectiveEndDate;

  return (
    <header className="animate-fade-in mb-3 md:mb-4">
      {/* Desktop */}
      <div className="hidden md:block">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <IdentityBar
            projectName={projectName}
            unitName={unitName}
            clientName={clientName}
            address={currentProject?.address ?? undefined}
            bairro={currentProject?.bairro ?? undefined}
            cep={currentProject?.cep ?? undefined}
            otherProjects={otherProjects}
            pendenciasStats={usePendencias({ projectId }).stats}
            pendenciasPath={paths.pendencias}
            onGoBack={handleGoBack}
            onProjectSwitch={handleProjectSwitch}
          />
          {showMetrics && (
            <ProjectStateSection
              metrics={projectMetrics}
              displayStartDate={displayStartDate}
              displayEndDate={displayEndDate}
              endDate={endDate}
              dateChangeInfo={dateChangeInfo}
              onShowDateChangeAlert={() => setShowDateChangeAlert(true)}
            />
          )}
          {showMetrics && (
            <MilestonesBar
              milestoneItems={milestoneItems}
              canEdit={canEditMilestones && !isMobile}
              onMilestoneDateChange={onMilestoneDateChange}
            />
          )}
        </div>
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

      {/* Mobile */}
      <MobileReportHeader
        projectName={projectName}
        unitName={unitName}
        clientName={clientName}
        address={currentProject?.address ?? undefined}
        bairro={currentProject?.bairro ?? undefined}
        cep={currentProject?.cep ?? undefined}
        otherProjects={otherProjects}
        pendenciasStats={usePendencias({ projectId }).stats}
        pendenciasPath={paths.pendencias}
        onGoBack={handleGoBack}
        onProjectSwitch={handleProjectSwitch}
        showMetrics={showMetrics}
        metrics={projectMetrics}
        displayStartDate={displayStartDate}
        displayEndDate={displayEndDate}
        milestoneItems={milestoneItems}
        canEditMilestones={canEditMilestones}
        onMilestoneDateChange={onMilestoneDateChange}
        isStaff={isStaff}
        hasActivities={activities.length > 0}
        cronogramaPath={paths.cronograma}
        isProjectPhase={isProjectPhase}
        activities={activities}
        startDate={startDate}
        effectiveEndDate={effectiveEndDate}
      />

      <DateChangeAlert
        open={showDateChangeAlert}
        onOpenChange={setShowDateChangeAlert}
        originalDate={dateChangeInfo.originalDate}
        newDate={dateChangeInfo.newDate}
        reason={dateChangeInfo.reason}
        contractClause={dateChangeInfo.contractClause}
      />

      <TeamContactEditModal
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        contact={editingContact}
        roleLabel={editingContact ? roleLabels[editingContact.role_type] : ''}
        onSave={async (data) => { await upsertContact(data); }}
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
