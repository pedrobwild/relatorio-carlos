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
    <div className="space-y-8 animate-fade-in">
      {/* Executive Summary */}
      <section>
        <ExecutiveSummary data={data} />
      </section>

      {/* Progress Evolution Chart (S-Curve) */}
      <section className="pt-2">
        <ProgressEvolutionChart activities={data.activities} currentWeek={data.weekNumber} />
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Lookahead (Next 7 Days) */}
      <section>
        <LookaheadSection tasks={data.lookaheadTasks} />
      </section>

      {/* Risks, Issues, Action Plans */}
      <section>
        <RisksIssuesSection issues={data.risksAndIssues} />
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Client Decisions */}
      <section>
        <ClientDecisionsSection decisions={data.clientDecisions} />
      </section>

      {/* Photo Gallery */}
      <section>
        <PhotoGallery photos={data.gallery} />
      </section>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Footer */}
      <section>
        <ReportFooter data={data} />
      </section>
    </div>
  );
};

export default WeeklyReportTemplate;
