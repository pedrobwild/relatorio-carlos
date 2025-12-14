import { WeeklyReportData } from "@/types/weeklyReport";
import ReportKPICards from "./ReportKPICards";
import ExecutiveSummary from "./ExecutiveSummary";
import ProgressEvolutionChart from "./ProgressEvolutionChart";
import LookaheadSection from "./LookaheadSection";
import RisksIssuesSection from "./RisksIssuesSection";
import QualitySection from "./QualitySection";
import ClientDecisionsSection from "./ClientDecisionsSection";
import PhotoGallery from "./PhotoGallery";
import ReportFooter from "./ReportFooter";

interface WeeklyReportTemplateProps {
  data: WeeklyReportData;
}

const WeeklyReportTemplate = ({ data }: WeeklyReportTemplateProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. KPIs and Header */}
      <ReportKPICards data={data} />

      {/* 2. Executive Summary */}
      <ExecutiveSummary data={data} />

      {/* 3. Progress Evolution Chart (S-Curve) */}
      <ProgressEvolutionChart activities={data.activities} currentWeek={data.weekNumber} />

      {/* 4. Lookahead (Next 7 Days) */}
      <LookaheadSection tasks={data.lookaheadTasks} />

      {/* 5. Risks, Issues, Action Plans */}
      <RisksIssuesSection issues={data.risksAndIssues} />

      {/* 6. Quality, Tests, Pending Items */}
      <QualitySection qualityItems={data.qualityItems} />

      {/* 7. Client Decisions */}
      <ClientDecisionsSection decisions={data.clientDecisions} />

      {/* 8. Photo Gallery */}
      <PhotoGallery photos={data.gallery} />

      {/* 9. Footer */}
      <ReportFooter data={data} />
    </div>
  );
};

export default WeeklyReportTemplate;
