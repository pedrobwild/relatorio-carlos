import { useState } from "react";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Activity, ReportData, ReportIncident } from "@/types/report";
import { ProjectInfoFields } from "./report/create-modal/ProjectInfoFields";
import { ActivitiesSection } from "./report/create-modal/ActivitiesSection";
import { IncidentsSection } from "./report/create-modal/IncidentsSection";

interface CreateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport: (data: ReportData) => void | Promise<void>;
}

const CreateReportModal = ({
  open,
  onOpenChange,
  onCreateReport,
}: CreateReportModalProps) => {
  const [projectName, setProjectName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      weight: 10,
    },
  ]);
  const [incidents, setIncidents] = useState<ReportIncident[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const reportData: ReportData = {
      projectName,
      unitName,
      clientName,
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : "",
      reportDate: format(reportDate, "yyyy-MM-dd"),
      activities: activities.filter((a) => a.description.trim() !== ""),
      incidents: incidents.filter((i) => i.occurrence.trim() !== ""),
    };

    setIsSubmitting(true);
    try {
      await onCreateReport(reportData);
      // Only reset form on success
      setProjectName("");
      setUnitName("");
      setClientName("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReportDate(new Date());
      setActivities([
        {
          id: crypto.randomUUID(),
          description: "",
          plannedStart: "",
          plannedEnd: "",
          actualStart: "",
          actualEnd: "",
          weight: 10,
        },
      ]);
      setIncidents([]);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao criar relatório";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateRangeValid = !startDate || !endDate || startDate <= endDate;
  const isFormValid =
    projectName &&
    clientName &&
    startDate &&
    endDate &&
    dateRangeValid &&
    activities.some((a) => a.description.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-h1 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Criar Novo Relatório
          </DialogTitle>
          <DialogDescription className="text-caption">
            Preencha os dados do projeto e atividades para gerar o relatório.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <ProjectInfoFields
              projectName={projectName}
              setProjectName={setProjectName}
              unitName={unitName}
              setUnitName={setUnitName}
              clientName={clientName}
              setClientName={setClientName}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              reportDate={reportDate}
              setReportDate={setReportDate}
            />

            <ActivitiesSection
              activities={activities}
              setActivities={setActivities}
            />

            <IncidentsSection
              incidents={incidents}
              setIncidents={setIncidents}
            />
          </form>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="gradient-primary min-h-[44px]"
          >
            {isSubmitting ? "Criando..." : "Criar Relatório"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReportModal;
