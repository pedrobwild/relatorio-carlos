import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Building2, User, Calendar, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Activity, ReportData } from "@/types/report";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport: (data: ReportData) => void;
}

const CreateReportModal = ({ open, onOpenChange, onCreateReport }: CreateReportModalProps) => {
  const [projectName, setProjectName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [activities, setActivities] = useState<Activity[]>([
    { description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "" }
  ]);

  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const addActivity = () => {
    setActivities([
      ...activities,
      { description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "" }
    ]);
  };

  const removeActivity = (index: number) => {
    if (activities.length > 1) {
      setActivities(activities.filter((_, i) => i !== index));
    }
  };

  const updateActivity = (index: number, field: keyof Activity, value: string) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
    setActivities(updated);
  };

  const formatDateToISO = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "yyyy-MM-dd");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const reportData: ReportData = {
      projectName,
      unitName,
      clientName,
      startDate: formatDateToISO(startDate),
      endDate: formatDateToISO(endDate),
      reportDate: formatDateToISO(reportDate),
      activities: activities.filter(a => a.description.trim() !== ""),
    };

    onCreateReport(reportData);
    
    // Reset form
    setProjectName("");
    setUnitName("");
    setClientName("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReportDate(new Date());
    setActivities([{ description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "" }]);
  };

  const isFormValid = projectName && clientName && startDate && endDate && 
    activities.some(a => a.description.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Criar Novo Relatório
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do projeto e atividades para gerar o relatório.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Project Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Informações do Projeto
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="projectName" className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Nome do Empreendimento
                  </Label>
                  <Input
                    id="projectName"
                    placeholder="Ex: Condomínio Residencial Aurora"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitName">Unidade</Label>
                  <Input
                    id="unitName"
                    placeholder="Ex: Apartamento 502"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientName" className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Nome do Cliente
                </Label>
                <Input
                  id="clientName"
                  placeholder="Ex: João da Silva"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Data de Início
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? formatDateForDisplay(startDate) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Data de Término Prevista
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? formatDateForDisplay(endDate) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Report Date Field */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Data de Geração do Relatório
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full md:w-auto justify-start text-left font-normal",
                        !reportDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDate ? formatDateForDisplay(reportDate) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={reportDate}
                      onSelect={(date) => date && setReportDate(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Define até onde a linha "realizado" aparece na Curva S
                </p>
              </div>
            </div>

            {/* Activities Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Cronograma de Atividades
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addActivity}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div
                    key={index}
                    className="p-4 border border-border rounded-lg bg-muted/30 space-y-3 animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Atividade #{index + 1}
                      </span>
                      {activities.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeActivity(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <Input
                      placeholder="Descrição da atividade"
                      value={activity.description}
                      onChange={(e) => updateActivity(index, "description", e.target.value)}
                    />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Início Prev.</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.plannedStart}
                          onChange={(e) => updateActivity(index, "plannedStart", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fim Prev.</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.plannedEnd}
                          onChange={(e) => updateActivity(index, "plannedEnd", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Início Real</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.actualStart}
                          onChange={(e) => updateActivity(index, "actualStart", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fim Real</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.actualEnd}
                          onChange={(e) => updateActivity(index, "actualEnd", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="gradient-primary"
          >
            Criar Relatório
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReportModal;
