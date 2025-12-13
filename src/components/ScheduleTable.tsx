import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Activity {
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
}

const activities: Activity[] = [
  {
    description: "EMPREITA 8 - Nivelamento de contra piso.",
    plannedStart: "17/11",
    plannedEnd: "18/11",
    actualStart: "12/12",
    actualEnd: "13/12",
  },
  {
    description: "EMPREITA 9 - Instalação do piso vinílico",
    plannedStart: "18/11",
    plannedEnd: "19/11",
    actualStart: "12/12",
    actualEnd: "13/12",
  },
  {
    description: "EMPREITA 10 - Cobrir o Piso.",
    plannedStart: "19/11",
    plannedEnd: "19/11",
    actualStart: "13/12",
    actualEnd: "13/12",
  },
  {
    description: "MARCENARIA – Montagem dos móveis marcenaria.",
    plannedStart: "24/11",
    plannedEnd: "1/12",
    actualStart: "16/12",
    actualEnd: "19/12",
  },
  {
    description: "VIDROS E ESPELHOS 3 - Instalação do box",
    plannedStart: "1/12",
    plannedEnd: "5/12",
    actualStart: "17/12",
    actualEnd: "17/12",
  },
  {
    description: "AR CONDICIONADO 3 - Instalação das máquinas de ar condicionado.",
    plannedStart: "17/11",
    plannedEnd: "17/11",
    actualStart: "5/1",
    actualEnd: "12/1",
  },
  {
    description: "COMPRAS 7 - Solicitação do Enxoval, Acessórios de cozinha, Acessórios de banheiro e diversos",
    plannedStart: "8/12",
    plannedEnd: "10/12",
    actualStart: "11/12",
    actualEnd: "12/12",
  },
  {
    description: "EMPREITA 12- Instalação do rodapé.",
    plannedStart: "8/12",
    plannedEnd: "12/12",
    actualStart: "5/1",
    actualEnd: "7/1",
  },
  {
    description: "EMPREITA 13 - Finalização da pintura.",
    plannedStart: "8/12",
    plannedEnd: "12/12",
    actualStart: "5/1",
    actualEnd: "7/1",
  },
  {
    description: "EMPREITA 13.1 Finalização de instalação de iluminação",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "5/1",
    actualEnd: "7/1",
  },
  {
    description: "CARRETO - Buscar materiais.",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "8/1",
    actualEnd: "8/1",
  },
  {
    description: "EMPREITA 14- Instalação de acessórios.",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "9/1",
    actualEnd: "14/1",
  },
  {
    description: "EMPREITA 15- Montagem de mobiliários.",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "9/1",
    actualEnd: "14/1",
  },
  {
    description: "VIDROS E ESPELHOS 4 - Instalação dos espelhos.",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "9/1",
    actualEnd: "14/1",
  },
  {
    description: "CORTINA 2- Instalação da cortina.",
    plannedStart: "15/12",
    plannedEnd: "18/12",
    actualStart: "16/01",
    actualEnd: "16/01",
  },
  {
    description: "Limpeza",
    plannedStart: "16/01",
    plannedEnd: "16/01",
    actualStart: "17/01",
    actualEnd: "17/01",
  },
];

const ScheduleTable = () => {
  return (
    <div className="mt-6 md:mt-8">
      <h3 className="text-base md:text-xl font-bold text-foreground mb-3 md:mb-4">
        Cronograma Detalhado
      </h3>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {activities.map((activity, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-lg p-3 shadow-sm"
          >
            <p className="text-sm font-medium text-foreground mb-2">
              {activity.description}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-accent/50 rounded p-2">
                <p className="text-muted-foreground mb-1">Previsto</p>
                <p className="text-foreground font-medium">
                  {activity.plannedStart} - {activity.plannedEnd}
                </p>
              </div>
              <div className="bg-success-light rounded p-2">
                <p className="text-muted-foreground mb-1">Realizado</p>
                <p className="text-foreground font-medium">
                  {activity.actualStart} - {activity.actualEnd}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border-2 border-muted-foreground/30 shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="gradient-primary hover:bg-transparent">
              <TableHead className="text-primary-foreground font-bold text-sm w-[40%] text-left border-r-2 border-primary-dark">
                DESCRIÇÃO DE ATIVIDADES
              </TableHead>
              <TableHead className="text-primary-foreground font-bold text-sm text-center border-r-2 border-primary-dark">
                DATA DE INÍCIO<br />PREVISTA
              </TableHead>
              <TableHead className="text-primary-foreground font-bold text-sm text-center border-r-2 border-primary-dark">
                DATA DE TÉRMINO<br />PREVISTO
              </TableHead>
              <TableHead className="bg-accent text-foreground font-bold text-sm text-center border-r-2 border-muted-foreground/30">
                DATA DE INÍCIO
              </TableHead>
              <TableHead className="bg-accent text-foreground font-bold text-sm text-center">
                DATA DE TÉRMINO
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((activity, index) => (
              <TableRow
                key={index}
                className="transition-colors hover:bg-muted/50"
              >
                <TableCell className="bg-accent/50 text-foreground text-sm font-medium border-r-2 border-border">
                  {activity.description}
                </TableCell>
                <TableCell className="text-center text-sm border-r-2 border-border">
                  {activity.plannedStart}
                </TableCell>
                <TableCell className="text-center text-sm border-r-2 border-border">
                  {activity.plannedEnd}
                </TableCell>
                <TableCell className="text-center text-sm border-r-2 border-border">
                  {activity.actualStart}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {activity.actualEnd}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ScheduleTable;
