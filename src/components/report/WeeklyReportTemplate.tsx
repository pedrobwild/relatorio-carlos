import { WeeklyReportData } from "@/types/weeklyReport";
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
    <div className="space-y-3 animate-fade-in">
      {/* Executive Summary */}
      <section>
        <ExecutiveSummary data={data} />
      </section>

      {/* Progress Evolution Chart (S-Curve) */}
      <section>
        <ProgressEvolutionChart activities={data.activities} currentWeek={data.weekNumber} />
      </section>

      {/* Lookahead (Next 7 Days) */}
      <section>
        <LookaheadSection tasks={data.lookaheadTasks} />
      </section>

      {/* Risks, Issues, Action Plans */}
      <section>
        <RisksIssuesSection issues={data.risksAndIssues} />
      </section>

      {/* Client Decisions */}
      <section>
        <ClientDecisionsSection decisions={data.clientDecisions} />
      </section>

      {/* Photo Gallery */}
      <section>
        <PhotoGallery photos={data.gallery} />
      </section>

      {/* Footer */}
      <section className="pt-2 border-t border-border/50">
        <ReportFooter data={data} />
      </section>
    </div>
  );
};

export default WeeklyReportTemplate;
