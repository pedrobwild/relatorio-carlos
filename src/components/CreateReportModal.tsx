import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Building2, User, Calendar, FileText, AlertOctagon, ChevronDown, ChevronUp } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Activity, ReportData, ReportIncident } from "@/types/report";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
    { description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "", weight: 10 }
  ]);
  const [incidents, setIncidents] = useState<ReportIncident[]>([]);
  const [incidentsOpen, setIncidentsOpen] = useState(false);

  const formatDateForDisplay = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const addActivity = () => {
    setActivities([
      ...activities,
      { description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "", weight: 10 }
    ]);
  };

  const removeActivity = (index: number) => {
    if (activities.length > 1) {
      setActivities(activities.filter((_, i) => i !== index));
    }
  };

  const updateActivity = (index: number, field: keyof Activity, value: string | number) => {
    const updated = [...activities];
    updated[index] = { ...updated[index], [field]: value };
    setActivities(updated);
  };

  // Calculate total weight of all activities
  const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 0), 0);

  const addIncident = () => {
    const newIncident: ReportIncident = {
      id: `inc-${Date.now()}`,
      occurrence: "",
      occurrenceDate: format(new Date(), "yyyy-MM-dd"),
      cause: "",
      action: "",
      impact: "",
      status: "aberto",
      expectedResolutionDate: "",
    };
    setIncidents([...incidents, newIncident]);
    setIncidentsOpen(true);
  };

  const removeIncident = (index: number) => {
    setIncidents(incidents.filter((_, i) => i !== index));
  };

  const updateIncident = (index: number, field: keyof ReportIncident, value: string) => {
    const updated = [...incidents];
    updated[index] = { ...updated[index], [field]: value };
    setIncidents(updated);
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
      incidents: incidents.filter(i => i.occurrence.trim() !== ""),
    };

    onCreateReport(reportData);
    
    // Reset form
    setProjectName("");
    setUnitName("");
    setClientName("");
    setStartDate(undefined);
    setEndDate(undefined);
    setReportDate(new Date());
    setActivities([{ description: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "", weight: 10 }]);
    setIncidents([]);
    setIncidentsOpen(false);
  };

  const isFormValid = projectName && clientName && startDate && endDate && 
    activities.some(a => a.description.trim() !== "");

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
            {/* Project Info Section */}
            <div className="space-y-4">
              <h3 className="text-h3 text-muted-foreground uppercase tracking-wider">
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
                <div>
                  <h3 className="text-h3 text-muted-foreground uppercase tracking-wider">
                    Cronograma de Atividades
                  </h3>
                  <p className={cn(
                    "text-tiny mt-0.5",
                    totalWeight === 100 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--warning))]"
                  )}>
                    Peso total: {totalWeight}% {totalWeight !== 100 && "(deve somar 100%)"}
                  </p>
                </div>
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
                      <span className="text-tiny font-medium">
                        Atividade #{index + 1}
                      </span>
                      {activities.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive"
                          onClick={() => removeActivity(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Descrição da atividade"
                        value={activity.description}
                        onChange={(e) => updateActivity(index, "description", e.target.value)}
                        className="flex-1"
                      />
                      <div className="w-20 shrink-0">
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            placeholder="Peso"
                            value={activity.weight || ""}
                            onChange={(e) => updateActivity(index, "weight", parseInt(e.target.value) || 0)}
                            className="text-sm pr-6"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tiny text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-tiny">Início Prev.</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.plannedStart}
                          onChange={(e) => updateActivity(index, "plannedStart", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-tiny">Fim Prev.</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.plannedEnd}
                          onChange={(e) => updateActivity(index, "plannedEnd", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-tiny">Início Real</Label>
                        <Input
                          placeholder="DD/MM"
                          value={activity.actualStart}
                          onChange={(e) => updateActivity(index, "actualStart", e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-tiny">Fim Real</Label>
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

            {/* Incidents Section */}
            <Collapsible open={incidentsOpen} onOpenChange={setIncidentsOpen}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <button 
                      type="button"
                      className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      <AlertOctagon className="w-4 h-4 text-destructive" />
                      Intercorrências de Obra
                      {incidents.length > 0 && (
                        <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded text-xs font-bold">
                          {incidents.length}
                        </span>
                      )}
                      {incidentsOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <Button type="button" variant="outline" size="sm" onClick={addIncident}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <CollapsibleContent className="space-y-4">
                  {incidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                      Nenhuma intercorrência registrada. Clique em "Adicionar" para registrar.
                    </p>
                  ) : (
                    incidents.map((incident, index) => (
                      <div
                        key={incident.id}
                        className="p-4 border border-destructive/20 rounded-lg bg-destructive/5 space-y-3 animate-fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-destructive flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5" />
                            Intercorrência #{index + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive"
                            onClick={() => removeIncident(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Status and Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <Select
                              value={incident.status}
                              onValueChange={(value) => updateIncident(index, "status", value)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aberto">Aberto</SelectItem>
                                <SelectItem value="em andamento">Em andamento</SelectItem>
                                <SelectItem value="resolvido">Resolvido</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Data da Ocorrência</Label>
                            <Input
                              type="date"
                              value={incident.occurrenceDate}
                              onChange={(e) => updateIncident(index, "occurrenceDate", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Previsão de Resolução</Label>
                            <Input
                              type="date"
                              value={incident.expectedResolutionDate}
                              onChange={(e) => updateIncident(index, "expectedResolutionDate", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        {/* Occurrence */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ocorrência</Label>
                          <Textarea
                            placeholder="Descreva o que aconteceu..."
                            value={incident.occurrence}
                            onChange={(e) => updateIncident(index, "occurrence", e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>

                        {/* Cause */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Causa</Label>
                          <Textarea
                            placeholder="Qual foi a causa do problema?"
                            value={incident.cause}
                            onChange={(e) => updateIncident(index, "cause", e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>

                        {/* Action */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Ação</Label>
                          <Textarea
                            placeholder="Quais ações foram tomadas?"
                            value={incident.action}
                            onChange={(e) => updateIncident(index, "action", e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>

                        {/* Impact */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Impacto</Label>
                          <Textarea
                            placeholder="Qual o impacto no projeto?"
                            value={incident.impact}
                            onChange={(e) => updateIncident(index, "impact", e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          </form>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid}
            className="gradient-primary min-h-[44px]"
          >
            Criar Relatório
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReportModal;
