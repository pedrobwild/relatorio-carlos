import React, { useState, useRef, useEffect } from "react";
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
import { FileText, Clock, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeeklyReportTemplateProps {
  data: WeeklyReportData;
  isStaff?: boolean;
  onSaveReport?: (updatedData: WeeklyReportData) => void;
  isSaving?: boolean;
}

const WeeklyReportTemplate = ({
  data,
  isStaff = false,
  onSaveReport,
  isSaving = false,
}: WeeklyReportTemplateProps) => {
  const [isEditing, setIsEditing] = useState(false);
  // Use local state for viewing; only initialize from prop on first mount
  // Do NOT sync from prop during editing to prevent data loss on save errors
  const [reportData, setReportData] = useState(data);
  
  // Track if we've ever had user edits to protect them
  const hasLocalEditsRef = useRef(false);

  // Check if the report has any content filled in
  const hasContent = 
    reportData.executiveSummary.length > 0 ||
    reportData.lookaheadTasks.length > 0 ||
    reportData.risksAndIssues.length > 0 ||
    reportData.clientDecisions.length > 0 ||
    reportData.incidents.length > 0 ||
    reportData.gallery.length > 0 ||
    (reportData.roomsProgress && reportData.roomsProgress.length > 0) ||
    reportData.deliverablesCompleted.length > 0;

  const handleSave = (updatedData: WeeklyReportData) => {
    hasLocalEditsRef.current = true;
    setReportData(updatedData);
    setIsEditing(false);
    onSaveReport?.(updatedData);
  };
  
  // Sync from prop ONLY when data changes from server AND we don't have local edits
  // This prevents overwriting user data when save fails and query refetches stale data
  useEffect(() => {
    // Only sync if the incoming data is substantively different and we haven't edited
    const incomingHasContent = 
      data.executiveSummary.length > 0 ||
      data.lookaheadTasks.length > 0 ||
      data.risksAndIssues.length > 0 ||
      data.clientDecisions.length > 0 ||
      data.incidents.length > 0 ||
      data.gallery.length > 0;
    
    // If server has newer/better data and we haven't made local edits, sync
    if (incomingHasContent && !hasLocalEditsRef.current) {
      setReportData(data);
    }
  }, [data]);

  // If editing, show the editor
  if (isEditing) {
    return (
      <WeeklyReportEditor
        data={reportData}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
        isSaving={isSaving}
      />
    );
  }

  // If no content and user is staff, show empty template with edit button
  if (!hasContent) {
    return (
      <div className="animate-fade-in">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
            <h3 className="text-h2 text-white">Relatório da Semana {reportData.weekNumber}</h3>
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
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Staff Edit Button */}
      {isStaff && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar Relatório
          </Button>
        </div>
      )}

      {/* Executive Summary */}
      <ExecutiveSummary data={reportData} />

      {/* Progress Timeline by Room */}
      {reportData.roomsProgress && reportData.roomsProgress.length > 0 && (
        <ProgressTimeline rooms={reportData.roomsProgress} />
      )}

      {/* Lookahead (Next 7 Days) */}
      {reportData.lookaheadTasks.length > 0 && (
        <LookaheadSection tasks={reportData.lookaheadTasks} />
      )}

      {/* Risks, Issues, Action Plans */}
      {reportData.risksAndIssues.length > 0 && (
        <RisksIssuesSection issues={reportData.risksAndIssues} />
      )}

      {/* Incidents */}
      {reportData.incidents.length > 0 && (
        <IncidentsSection incidents={reportData.incidents} />
      )}

      {/* Client Decisions */}
      {reportData.clientDecisions.length > 0 && (
        <ClientDecisionsSection decisions={reportData.clientDecisions} />
      )}

      {/* Photo Gallery */}
      {reportData.gallery.length > 0 && (
        <PhotoGallery photos={reportData.gallery} />
      )}

      {/* Footer */}
      <div className="pt-1 border-t border-border/50">
        <ReportFooter data={reportData} />
      </div>
    </div>
  );
};

export default WeeklyReportTemplate;
