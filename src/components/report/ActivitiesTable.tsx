import { WeeklyReportActivitySnapshot } from "@/types/weeklyReport";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ActivitiesTableProps {
  activities: WeeklyReportActivitySnapshot[];
}

const getStatusBadge = (status: WeeklyReportActivitySnapshot["status"]) => {
  switch (status) {
    case "concluído":
      return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Concluído</Badge>;
    case "em andamento":
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Em andamento</Badge>;
    case "pendente":
      return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Pendente</Badge>;
    case "atrasado":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Atrasado</Badge>;
    default:
      return null;
  }
};

const getVarianceText = (days: number) => {
  if (days === 0) return <span className="text-muted-foreground">No prazo</span>;
  if (days < 0) return <span className="text-success">{days}d</span>;
  return <span className="text-destructive">+{days}d</span>;
};

const ActivitiesTable = ({ activities }: ActivitiesTableProps) => {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">Cronograma de Atividades</h3>
      </div>
      
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Atividade</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Real</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Desvio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity) => (
              <TableRow key={activity.activityId}>
                <TableCell className="font-medium text-foreground">
                  {activity.description}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(activity.plannedStart), "dd/MM", { locale: ptBR })} - {format(new Date(activity.plannedEnd), "dd/MM", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {activity.actualStart 
                    ? `${format(new Date(activity.actualStart), "dd/MM", { locale: ptBR })}${activity.actualEnd ? ` - ${format(new Date(activity.actualEnd), "dd/MM", { locale: ptBR })}` : " - ..."}`
                    : "-"
                  }
                </TableCell>
                <TableCell>{getStatusBadge(activity.status)}</TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {getVarianceText(activity.varianceDays)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border">
        {activities.map((activity) => (
          <div key={activity.activityId} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-foreground text-sm">{activity.description}</span>
              {getStatusBadge(activity.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="block text-muted-foreground/70">Previsto</span>
                {format(new Date(activity.plannedStart), "dd/MM", { locale: ptBR })} - {format(new Date(activity.plannedEnd), "dd/MM", { locale: ptBR })}
              </div>
              <div>
                <span className="block text-muted-foreground/70">Real</span>
                {activity.actualStart 
                  ? `${format(new Date(activity.actualStart), "dd/MM", { locale: ptBR })}${activity.actualEnd ? ` - ${format(new Date(activity.actualEnd), "dd/MM", { locale: ptBR })}` : ""}`
                  : "-"
                }
              </div>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground/70">Desvio: </span>
              {getVarianceText(activity.varianceDays)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivitiesTable;
