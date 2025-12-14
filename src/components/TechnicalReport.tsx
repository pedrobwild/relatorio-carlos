import { cn } from "@/lib/utils";
import { WeeklyReport, Activity } from "@/types/report";
import WeeklyProgressChart from "./WeeklyProgressChart";

interface ReportSectionProps {
  title: string;
  variant: "purple" | "blue" | "green" | "orange" | "yellow";
  children: React.ReactNode;
  className?: string;
}

interface TechnicalReportProps {
  weeklyReport: WeeklyReport;
  clientName: string;
  activities: Activity[];
  endDate: string;
  projectStartDate: string;
}

const sectionVariants = {
  purple: "border-l-primary bg-gradient-to-r from-accent to-card",
  blue: "border-l-info bg-gradient-to-r from-info-light to-card",
  green: "border-l-success bg-gradient-to-r from-success-light to-card",
  orange: "border-l-warning bg-gradient-to-r from-warning-light to-card",
  yellow: "border-l-warning bg-gradient-to-r from-warning-light to-card",
};

const ReportSection = ({ title, variant, children, className }: ReportSectionProps) => (
  <div
    className={cn(
      "p-4 md:p-6 rounded-lg mb-4 md:mb-6 border-l-4",
      sectionVariants[variant],
      className
    )}
  >
    {title && (
      <h3 className="text-base md:text-xl font-bold text-foreground mb-3 md:mb-4">{title}</h3>
    )}
    {children}
  </div>
);

// Helper to get week phase description
const getPhaseDescription = (weekNumber: number, totalWeeks: number): string => {
  const progress = weekNumber / totalWeeks;
  if (progress <= 0.2) return "início";
  if (progress <= 0.4) return "fase inicial";
  if (progress <= 0.6) return "fase intermediária";
  if (progress <= 0.8) return "fase avançada";
  return "reta final";
};

// Helper to get activities in progress during the week
const getWeekActivities = (
  activities: Activity[],
  weekStart: Date,
  weekEnd: Date
): { completed: Activity[]; inProgress: Activity[]; upcoming: Activity[] } => {
  const completed: Activity[] = [];
  const inProgress: Activity[] = [];
  const upcoming: Activity[] = [];

  activities.forEach((activity) => {
    const plannedStart = new Date(activity.plannedStart);
    const plannedEnd = new Date(activity.plannedEnd);
    const actualEnd = activity.actualEnd ? new Date(activity.actualEnd) : null;

    if (actualEnd && actualEnd <= weekEnd) {
      completed.push(activity);
    } else if (plannedStart <= weekEnd && plannedEnd >= weekStart) {
      inProgress.push(activity);
    } else if (plannedStart > weekEnd) {
      upcoming.push(activity);
    }
  });

  return { completed, inProgress, upcoming };
};

// Generate dynamic greeting based on progress
const getGreeting = (completion: number, phase: string): string => {
  if (completion < 25) {
    return `Estamos na ${phase} do projeto, com os trabalhos de preparação e mobilização sendo executados conforme planejado.`;
  }
  if (completion < 50) {
    return `Avançamos bem na ${phase}, com as principais frentes de trabalho em execução simultânea.`;
  }
  if (completion < 75) {
    return `Entramos na ${phase} com bom ritmo de execução e as atividades críticas sendo priorizadas.`;
  }
  return `Estamos na ${phase} de entrega, focando nos acabamentos finais e preparação para conclusão.`;
};

// Generate dynamic status based on week data
const getStatusMessage = (completion: number, weekNumber: number): string => {
  if (completion === 0) {
    return "Iniciamos a mobilização da obra com preparação do canteiro e alinhamento das equipes.";
  }
  if (completion < 30) {
    return "As frentes de trabalho estão sendo organizadas com foco na infraestrutura básica e preparação para as próximas etapas.";
  }
  if (completion < 60) {
    return "O projeto está em plena execução com múltiplas frentes ativas. Mantemos o cronograma sob controle rigoroso.";
  }
  if (completion < 90) {
    return "Entramos na fase de acabamentos, com atenção redobrada à qualidade e aos detalhes de entrega.";
  }
  return "Estamos finalizando os últimos detalhes para entrega. A obra está em fase de conclusão e limpeza final.";
};

const TechnicalReport = ({ weeklyReport, clientName, activities, endDate, projectStartDate }: TechnicalReportProps) => {
  const totalWeeks = 20; // Estimated total project weeks
  const phase = getPhaseDescription(weeklyReport.weekNumber, totalWeeks);
  const { completed, inProgress, upcoming } = getWeekActivities(
    activities,
    weeklyReport.startDate,
    weeklyReport.endDate
  );

  const formattedEndDate = new Date(endDate).toLocaleDateString('pt-BR');

  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <ReportSection variant="purple" title="">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Atualização Técnica - Semana {weeklyReport.weekNumber}
        </h2>
      </ReportSection>

      <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-4 md:mb-6">
        <strong className="text-foreground">Olá, {clientName}, tudo bem?</strong>
        <br /><br />
        {getGreeting(weeklyReport.completionPercentage, phase)}{" "}
        {getStatusMessage(weeklyReport.completionPercentage, weeklyReport.weekNumber)}{" "}
        <strong className="text-foreground">Mantemos a data de entrega em {formattedEndDate}</strong>.
      </p>

      <ReportSection variant="blue" title="1) Resumo da Semana">
        <WeeklyProgressChart
          activities={activities}
          projectStartDate={projectStartDate}
          currentWeekNumber={weeklyReport.weekNumber}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 mb-4">
          <div className="bg-card/50 rounded-lg p-3 border border-border">
            <p className="text-2xl font-bold text-success">{completed.length}</p>
            <p className="text-xs text-muted-foreground">Atividades concluídas</p>
          </div>
          <div className="bg-card/50 rounded-lg p-3 border border-border">
            <p className="text-2xl font-bold text-primary">{inProgress.length}</p>
            <p className="text-xs text-muted-foreground">Em andamento</p>
          </div>
          <div className="bg-card/50 rounded-lg p-3 border border-border">
            <p className="text-2xl font-bold text-muted-foreground">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Próximas etapas</p>
          </div>
        </div>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li>Progresso acumulado: <strong className="text-foreground">{weeklyReport.completionPercentage}%</strong> do projeto concluído.</li>
          <li>Período: {weeklyReport.startDate.toLocaleDateString('pt-BR')} a {weeklyReport.endDate.toLocaleDateString('pt-BR')}</li>
          {inProgress.length > 0 && (
            <li>Foco principal: {inProgress.slice(0, 2).map(a => a.description).join(" e ")}</li>
          )}
        </ul>
      </ReportSection>

      {inProgress.length > 0 && (
        <ReportSection variant="green" title="2) Atividades em Execução">
          <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
            {inProgress.map((activity, index) => (
              <li key={index}>
                <strong className="text-foreground">{activity.description}</strong>
                <span className="text-xs ml-2">
                  (Previsto: {new Date(activity.plannedStart).toLocaleDateString('pt-BR')} - {new Date(activity.plannedEnd).toLocaleDateString('pt-BR')})
                </span>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {completed.length > 0 && (
        <ReportSection variant="orange" title="3) Atividades Concluídas">
          <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
            {completed.slice(-5).map((activity, index) => (
              <li key={index}>
                <strong className="text-foreground">{activity.description}</strong>
                {activity.actualEnd && (
                  <span className="text-xs ml-2 text-success">
                    (Finalizado em {new Date(activity.actualEnd).toLocaleDateString('pt-BR')})
                  </span>
                )}
              </li>
            ))}
            {completed.length > 5 && (
              <li className="text-muted-foreground italic">
                ...e mais {completed.length - 5} atividades anteriores
              </li>
            )}
          </ul>
        </ReportSection>
      )}

      {upcoming.length > 0 && (
        <ReportSection variant="yellow" title="4) Próximas Etapas">
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
            Nas próximas semanas, daremos continuidade com:
          </p>
          <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
            {upcoming.slice(0, 4).map((activity, index) => (
              <li key={index}>
                {activity.description}
                <span className="text-xs ml-2">
                  (Início previsto: {new Date(activity.plannedStart).toLocaleDateString('pt-BR')})
                </span>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      <ReportSection variant="purple" title="5) Governança e Controle">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Para garantir a entrega no prazo e com qualidade, mantemos:
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li><strong className="text-foreground">Plano semanal (lookahead):</strong> programação dos próximos 7 dias com pré-requisitos travados</li>
          <li><strong className="text-foreground">Check de frentes:</strong> equipe, material e área verificados antes de cada início</li>
          <li><strong className="text-foreground">Checklist de qualidade:</strong> verificação de acabamento antes de considerar atividade concluída</li>
        </ul>
      </ReportSection>

      <div className="bg-gradient-to-r from-accent to-primary/20 p-4 md:p-6 rounded-lg mt-6 md:mt-8">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Fico à disposição para qualquer esclarecimento. Seguimos com o compromisso de entregar no prazo e com qualidade.
        </p>
        <p className="font-semibold text-foreground text-sm md:text-base">Pedro Henrique Alves Pereira</p>
        <p className="text-primary font-bold text-sm md:text-base">CEO - Bwild</p>
      </div>
    </div>
  );
};

export default TechnicalReport;
