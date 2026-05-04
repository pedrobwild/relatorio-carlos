import { useState } from "react";
import { WeeklyReport, Activity } from "@/types/report";
import WeeklyProgressChart from "./WeeklyProgressChart";
import { parseLocalDate } from "@/lib/activityStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ListChecks,
  Clock,
  ChevronRight,
  Clipboard,
  Settings,
} from "lucide-react";

interface TechnicalReportProps {
  weeklyReport: WeeklyReport;
  clientName: string;
  activities: Activity[];
  endDate: string;
  projectStartDate: string;
}

// Helper to get activities in progress during the week
const getWeekActivities = (
  activities: Activity[],
  weekStart: Date,
  weekEnd: Date,
): { completed: Activity[]; inProgress: Activity[]; upcoming: Activity[] } => {
  const completed: Activity[] = [];
  const inProgress: Activity[] = [];
  const upcoming: Activity[] = [];

  activities.forEach((activity) => {
    const plannedStart = parseLocalDate(activity.plannedStart);
    const plannedEnd = parseLocalDate(activity.plannedEnd);
    const actualEnd = activity.actualEnd
      ? parseLocalDate(activity.actualEnd)
      : null;

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

// Modal button component
interface ReportModalButtonProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
  title: string;
}

const ReportModalButton = ({
  icon,
  label,
  count,
  children,
  title,
}: ReportModalButtonProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        variant="ghost"
        className="w-full justify-between h-auto py-4 px-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            {icon}
          </div>
          <span className="font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <span className="text-sm font-bold text-muted-foreground">
              {count}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
      </DialogHeader>
      <div className="mt-4">{children}</div>
    </DialogContent>
  </Dialog>
);

const TechnicalReport = ({
  weeklyReport,
  clientName,
  activities,
  endDate,
  projectStartDate,
}: TechnicalReportProps) => {
  const { completed, inProgress, upcoming } = getWeekActivities(
    activities,
    weeklyReport.startDate,
    weeklyReport.endDate,
  );

  const formattedEndDate = new Date(endDate).toLocaleDateString("pt-BR");

  return (
    <div
      className="animate-fade-in space-y-4"
      style={{ animationDelay: "0.1s" }}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-success">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Atividades concluídas</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-primary">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">Em andamento</p>
        </div>
        <div className="bg-card rounded-lg p-4 border border-border">
          <p className="text-2xl font-bold text-muted-foreground">
            {upcoming.length}
          </p>
          <p className="text-xs text-muted-foreground">Próximas etapas</p>
        </div>
      </div>

      {/* Summary info */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            Progresso acumulado:{" "}
            <strong className="text-foreground">
              {weeklyReport.completionPercentage}%
            </strong>{" "}
            do projeto concluído.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
            Período: {weeklyReport.startDate.toLocaleDateString("pt-BR")} a{" "}
            {weeklyReport.endDate.toLocaleDateString("pt-BR")}
          </li>
          {inProgress.length > 0 && (
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-info shrink-0" />
              Foco principal:{" "}
              {inProgress
                .slice(0, 2)
                .map((a) => a.description)
                .join(" e ")}
            </li>
          )}
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            Previsão de entrega:{" "}
            <strong className="text-foreground">{formattedEndDate}</strong>
          </li>
        </ul>
      </div>

      {/* Progress Chart */}
      <WeeklyProgressChart
        activities={activities}
        projectStartDate={projectStartDate}
        currentWeekNumber={weeklyReport.weekNumber}
      />

      {/* Modal Buttons */}
      <div className="space-y-3">
        {/* Resumo Executivo */}
        <ReportModalButton
          icon={<FileText className="w-4 h-4 text-muted-foreground" />}
          label="Resumo Executivo"
          title="Resumo Executivo"
        >
          <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
            <p className="italic text-center py-8 text-muted-foreground/70">
              Campo para o resumo escrito pelo engenheiro responsável com as
              informações mais importantes da semana.
            </p>
          </div>
        </ReportModalButton>

        {/* Atividades em Execução */}
        {inProgress.length > 0 && (
          <ReportModalButton
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
            label="Atividades em Execução"
            count={inProgress.length}
            title="Atividades em Execução"
          >
            <ul className="space-y-3">
              {inProgress.map((activity, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Previsto:{" "}
                      {parseLocalDate(activity.plannedStart).toLocaleDateString(
                        "pt-BR",
                      )}{" "}
                      -{" "}
                      {parseLocalDate(activity.plannedEnd).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ReportModalButton>
        )}

        {/* Atividades Concluídas */}
        {completed.length > 0 && (
          <ReportModalButton
            icon={<ListChecks className="w-4 h-4 text-muted-foreground" />}
            label="Atividades Concluídas"
            count={completed.length}
            title="Atividades Concluídas"
          >
            <ul className="space-y-3">
              {completed.slice(-10).map((activity, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {activity.description}
                    </p>
                    {activity.actualEnd && (
                      <p className="text-xs text-success mt-1">
                        Finalizado em{" "}
                        {parseLocalDate(activity.actualEnd).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {completed.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  ...e mais {completed.length - 10} atividades anteriores
                </p>
              )}
            </ul>
          </ReportModalButton>
        )}

        {/* Próximas Etapas */}
        {upcoming.length > 0 && (
          <ReportModalButton
            icon={<Clipboard className="w-4 h-4 text-muted-foreground" />}
            label="Próximas Etapas"
            count={upcoming.length}
            title="Próximas Etapas"
          >
            <ul className="space-y-3">
              {upcoming.slice(0, 8).map((activity, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Início previsto:{" "}
                      {parseLocalDate(activity.plannedStart).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  </div>
                </li>
              ))}
              {upcoming.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  ...e mais {upcoming.length - 8} atividades futuras
                </p>
              )}
            </ul>
          </ReportModalButton>
        )}

        {/* Governança e Controle */}
        <ReportModalButton
          icon={<Settings className="w-4 h-4 text-muted-foreground" />}
          label="Governança e Controle"
          title="Governança e Controle"
        >
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p className="mb-4">
              Para garantir a entrega no prazo e com qualidade, mantemos:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Plano semanal (lookahead)
                  </p>
                  <p className="text-xs mt-1">
                    Programação dos próximos 7 dias com pré-requisitos travados
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Check de frentes
                  </p>
                  <p className="text-xs mt-1">
                    Equipe, material e área verificados antes de cada início
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground">
                    Checklist de qualidade
                  </p>
                  <p className="text-xs mt-1">
                    Verificação de acabamento antes de considerar atividade
                    concluída
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </ReportModalButton>
      </div>

      {/* Signature */}
      <div className="bg-card rounded-lg p-4 border border-border mt-6">
        <p className="text-sm text-muted-foreground mb-3">
          Fico à disposição para qualquer esclarecimento.
        </p>
        <p className="font-semibold text-foreground text-sm">
          Pedro Henrique Alves Pereira
        </p>
        <p className="text-primary font-bold text-sm">CEO - Bwild</p>
      </div>
    </div>
  );
};

export default TechnicalReport;
