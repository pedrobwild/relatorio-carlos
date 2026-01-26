import { WeeklyReportData } from "@/types/weeklyReport";
import ExecutiveSummary from "./ExecutiveSummary";
import LookaheadSection from "./LookaheadSection";
import RisksIssuesSection from "./RisksIssuesSection";
import ClientDecisionsSection from "./ClientDecisionsSection";
import IncidentsSection from "./IncidentsSection";
import PhotoGallery from "./PhotoGallery";
import ReportFooter from "./ReportFooter";
import ProgressTimeline from "./ProgressTimeline";
import { FileText, Clock } from "lucide-react";

interface WeeklyReportTemplateProps {
  data: WeeklyReportData;
}

const WeeklyReportTemplate = ({ data }: WeeklyReportTemplateProps) => {
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

  // If no content, show empty template state
  if (!hasContent) {
    return (
      <div className="animate-fade-in">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-primary-dark">
            <h3 className="text-h2 text-white">Relatório da Semana {data.weekNumber}</h3>
          </div>
          <div className="p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-semibold mb-2">Relatório em preparação</h4>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              O engenheiro responsável está preparando o relatório desta semana. 
              O conteúdo será disponibilizado em breve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in">
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
      <div className="pt-1 border-t border-border/50">
        <ReportFooter data={data} />
      </div>
    </div>
  );
};

export default WeeklyReportTemplate;
