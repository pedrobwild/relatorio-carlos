import bwildLogo from "@/assets/bwild-logo.png";

interface ReportHeaderProps {
  projectName: string;
  unitName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  completedActivities: number;
  totalActivities: number;
  startedActivities: number;
}

const ReportHeader = ({
  projectName,
  unitName,
  clientName,
  startDate,
  endDate,
  completedActivities,
  totalActivities,
  startedActivities,
}: ReportHeaderProps) => {
  const completedPercentage = ((completedActivities / totalActivities) * 100).toFixed(1);
  const startedPercentage = ((startedActivities / totalActivities) * 100).toFixed(1);

  return (
    <header className="bg-card rounded-xl shadow-card p-6 md:p-8 mb-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <img 
          src={bwildLogo} 
          alt="Bwild Logo" 
          className="h-12 md:h-14 w-auto"
        />
        <div className="text-left md:text-right">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
            Relatório de Obra
          </h1>
          <p className="text-muted-foreground">{projectName} - {unitName}</p>
          <p className="text-sm text-muted-foreground mt-1">{clientName}</p>
        </div>
      </div>

      <div className="border-t-2 border-border pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <StatCard label="Início da Obra" value={startDate} />
          <StatCard label="Previsão de Término" value={endDate} />
          <StatCard
            label="Atividades Concluídas"
            value={`${completedActivities}/${totalActivities}`}
            subValue={`${completedPercentage}%`}
            variant="success"
          />
          <StatCard
            label="Atividades Iniciadas"
            value={`${startedActivities}/${totalActivities}`}
            subValue={`${startedPercentage}%`}
            variant="info"
          />
        </div>
      </div>
    </header>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: "default" | "success" | "info";
}

const StatCard = ({ label, value, subValue, variant = "default" }: StatCardProps) => {
  const valueColorClass = {
    default: "text-primary",
    success: "text-success",
    info: "text-info",
  }[variant];

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-2">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${valueColorClass}`}>{value}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
};

export default ReportHeader;
