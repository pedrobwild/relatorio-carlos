import React, { useState, useCallback } from "react";
import { WeeklyReportData } from "@/types/weeklyReport";
import ExecutiveSummary from "./ExecutiveSummary";
import LookaheadSection from "./LookaheadSection";
import RisksIssuesSection from "./RisksIssuesSection";
import ClientDecisionsSection from "./ClientDecisionsSection";
import IncidentsSection from "./IncidentsSection";
import PhotoGallery from "./PhotoGallery";
import ReportFooter from "./ReportFooter";
import ProgressTimeline from "./ProgressTimeline";
import WeeklyReportEditor from "./WeeklyReportEditor";
import { Clock, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyReportTemplateProps {
  data: WeeklyReportData;
  isStaff?: boolean;
  projectId?: string;
  onSaveReport?: (updatedData: WeeklyReportData) => void;
  isSaving?: boolean;
}

const WeeklyReportTemplate = ({
  data,
  isStaff = false,
  projectId,
  onSaveReport,
  isSaving = false,
}: WeeklyReportTemplateProps) => {
  const [isEditing, setIsEditing] = useState(false);

  // Check if the report has any content filled in
  const hasContent = 
    data.executiveSummary.length > 0 ||
    data.lookaheadTasks.length > 0 ||
    data.risksAndIssues.length > 0 ||
    data.clientDecisions.length > 0 ||
    data.incidents.length > 0 ||
    data.gallery.length > 0 ||
    (data.roomsProgress && data.roomsProgress.length > 0) ||
    data.deliverablesCompleted.length > 0;

  const handleAutoSave = useCallback(
    (updatedData: WeeklyReportData) => {
      onSaveReport?.(updatedData);
    },
    [onSaveReport]
  );

  const handleSaveAndClose = useCallback(
    (updatedData: WeeklyReportData) => {
      setIsEditing(false);
      onSaveReport?.(updatedData);
    },
    [onSaveReport]
  );

  // If editing, show the editor
  if (isEditing) {
    return (
      <WeeklyReportEditor
        data={data}
        onAutoSave={handleAutoSave}
        onSaveAndClose={handleSaveAndClose}
        onCancel={() => setIsEditing(false)}
        isSaving={isSaving}
      />
    );
  }

  // If no content and user is staff, show empty template with edit button
  if (!hasContent) {
    return (
      <div className="animate-fade-in">
        <div className="max-w-[840px] mx-auto">
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-primary-dark">
              <h3 className="text-base font-semibold text-white">Relatório da Semana {data.weekNumber}</h3>
            </div>
            <div className="p-6 sm:p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Relatório em preparação</h4>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                {isStaff 
                  ? "Este relatório ainda não foi preenchido. Clique no botão abaixo para começar a editar."
                  : "O engenheiro responsável está preparando o relatório desta semana. O conteúdo será disponibilizado em breve."}
              </p>
              {isStaff && (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Preencher Relatório
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Reading container for optimal readability */}
      <div className="max-w-[840px] mx-auto space-y-6">
        {/* Staff Edit Button */}
        {isStaff && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar Relatório
            </Button>
          </div>
        )}

        {/* Executive Summary */}
        <ExecutiveSummary data={data} />

        {/* Progress Timeline by Room */}
        {data.roomsProgress && data.roomsProgress.length > 0 && (
          <ProgressTimeline rooms={data.roomsProgress} />
        )}

        {/* Lookahead (Next 7 Days) */}
        {data.lookaheadTasks.length > 0 && (
          <LookaheadSection tasks={data.lookaheadTasks} />
        )}

        {/* Risks, Issues, Action Plans */}
        {data.risksAndIssues.length > 0 && (
          <RisksIssuesSection issues={data.risksAndIssues} />
        )}

        {/* Incidents */}
        {data.incidents.length > 0 && (
          <IncidentsSection incidents={data.incidents} />
        )}

        {/* Client Decisions */}
        {data.clientDecisions.length > 0 && (
          <ClientDecisionsSection decisions={data.clientDecisions} />
        )}

        {/* Photo Gallery */}
        {data.gallery.length > 0 && (
          <PhotoGallery photos={data.gallery} />
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border/50">
          <ReportFooter data={data} />
        </div>
      </div>
    </div>
  );
};

export default WeeklyReportTemplate;
