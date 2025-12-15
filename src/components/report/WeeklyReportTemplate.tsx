import { WeeklyReportData } from "@/types/weeklyReport";
import ExecutiveSummary from "./ExecutiveSummary";
import LookaheadSection from "./LookaheadSection";
import RisksIssuesSection from "./RisksIssuesSection";
import QualitySection from "./QualitySection";
import ClientDecisionsSection from "./ClientDecisionsSection";
import IncidentsSection from "./IncidentsSection";
import PhotoGallery from "./PhotoGallery";
import ReportFooter from "./ReportFooter";
interface WeeklyReportTemplateProps {
  data: WeeklyReportData;
}

const WeeklyReportTemplate = ({ data }: WeeklyReportTemplateProps) => {
  return (
    <div className="space-y-2 animate-fade-in">
      {/* Executive Summary */}
      <ExecutiveSummary data={data} />

      {/* Lookahead (Next 7 Days) */}
      <LookaheadSection tasks={data.lookaheadTasks} />

      {/* Risks, Issues, Action Plans */}
      <RisksIssuesSection issues={data.risksAndIssues} />

      {/* Incidents */}
      <IncidentsSection incidents={data.incidents} />

      {/* Client Decisions */}
      <ClientDecisionsSection decisions={data.clientDecisions} />

      {/* Photo Gallery */}
      <PhotoGallery photos={data.gallery} />

      {/* Footer */}
      <div className="pt-1 border-t border-border/50">
        <ReportFooter data={data} />
      </div>
    </div>
  );
};

export default WeeklyReportTemplate;
