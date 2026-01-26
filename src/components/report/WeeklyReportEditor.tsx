import { useState } from "react";
import { WeeklyReportData, LookaheadTask, RiskIssue, ClientDecision, Incident, GalleryPhoto } from "@/types/weeklyReport";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, FileText, AlertTriangle, Calendar, Camera, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface WeeklyReportEditorProps {
  data: WeeklyReportData;
  onSave: (updatedData: WeeklyReportData) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

const WeeklyReportEditor = ({ data, onSave, onCancel, isSaving }: WeeklyReportEditorProps) => {
  const [formData, setFormData] = useState<WeeklyReportData>(data);

  const handleSave = () => {
    onSave(formData);
    toast.success("Relatório salvo com sucesso!");
  };

  const updateExecutiveSummary = (value: string) => {
    setFormData(prev => ({ ...prev, executiveSummary: value }));
  };

  // Lookahead Tasks
  const addLookaheadTask = () => {
    const newTask: LookaheadTask = {
      id: `task-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: "",
      prerequisites: "",
      responsible: "",
      risk: "baixo",
    };
    setFormData(prev => ({ ...prev, lookaheadTasks: [...prev.lookaheadTasks, newTask] }));
  };

  const updateLookaheadTask = (index: number, field: keyof LookaheadTask, value: string) => {
    setFormData(prev => ({
      ...prev,
      lookaheadTasks: prev.lookaheadTasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      ),
    }));
  };

  const removeLookaheadTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lookaheadTasks: prev.lookaheadTasks.filter((_, i) => i !== index),
    }));
  };

  // Risks and Issues
  const addRiskIssue = () => {
    const newRisk: RiskIssue = {
      id: `risk-${Date.now()}`,
      type: "risco",
      title: "",
      description: "",
      impact: { time: "baixo", cost: "baixo", quality: "baixo" },
      severity: "baixa",
      actionPlan: "",
      owner: "",
      dueDate: new Date().toISOString().split('T')[0],
      status: "aberto",
    };
    setFormData(prev => ({ ...prev, risksAndIssues: [...prev.risksAndIssues, newRisk] }));
  };

  const updateRiskIssue = (index: number, updates: Partial<RiskIssue>) => {
    setFormData(prev => ({
      ...prev,
      risksAndIssues: prev.risksAndIssues.map((risk, i) => 
        i === index ? { ...risk, ...updates } : risk
      ),
    }));
  };

  const removeRiskIssue = (index: number) => {
    setFormData(prev => ({
      ...prev,
      risksAndIssues: prev.risksAndIssues.filter((_, i) => i !== index),
    }));
  };

  // Client Decisions
  const addClientDecision = () => {
    const newDecision: ClientDecision = {
      id: `decision-${Date.now()}`,
      description: "",
      impactIfDelayed: "",
      dueDate: new Date().toISOString().split('T')[0],
      status: "pending",
    };
    setFormData(prev => ({ ...prev, clientDecisions: [...prev.clientDecisions, newDecision] }));
  };

  const updateClientDecision = (index: number, field: keyof ClientDecision, value: string) => {
    setFormData(prev => ({
      ...prev,
      clientDecisions: prev.clientDecisions.map((decision, i) => 
        i === index ? { ...decision, [field]: value } : decision
      ),
    }));
  };

  const removeClientDecision = (index: number) => {
    setFormData(prev => ({
      ...prev,
      clientDecisions: prev.clientDecisions.filter((_, i) => i !== index),
    }));
  };

  // Incidents
  const addIncident = () => {
    const newIncident: Incident = {
      id: `incident-${Date.now()}`,
      occurrence: "",
      occurrenceDate: new Date().toISOString().split('T')[0],
      cause: "",
      action: "",
      impact: "",
      status: "aberto",
      expectedResolutionDate: new Date().toISOString().split('T')[0],
    };
    setFormData(prev => ({ ...prev, incidents: [...prev.incidents, newIncident] }));
  };

  const updateIncident = (index: number, field: keyof Incident, value: string) => {
    setFormData(prev => ({
      ...prev,
      incidents: prev.incidents.map((incident, i) => 
        i === index ? { ...incident, [field]: value } : incident
      ),
    }));
  };

  const removeIncident = (index: number) => {
    setFormData(prev => ({
      ...prev,
      incidents: prev.incidents.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="bg-primary-dark text-white rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Editar Relatório - Semana {formData.weekNumber}</h2>
              <p className="text-sm text-white/80">
                Período: {formData.periodStart} a {formData.periodEnd}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Cancelar
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving} className="bg-white text-primary hover:bg-white/90">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Salvando..." : "Salvar Relatório"}
            </Button>
          </div>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["summary", "lookahead"]} className="space-y-2">
        {/* Executive Summary */}
        <AccordionItem value="summary" className="bg-card border border-border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-semibold">Resumo Executivo</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <Textarea
              placeholder="Descreva o resumo das atividades realizadas nesta semana..."
              value={formData.executiveSummary}
              onChange={(e) => updateExecutiveSummary(e.target.value)}
              className="min-h-[120px]"
            />
          </AccordionContent>
        </AccordionItem>

        {/* Lookahead Tasks */}
        <AccordionItem value="lookahead" className="bg-card border border-border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-semibold">Próximos 7 Dias ({formData.lookaheadTasks.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {formData.lookaheadTasks.map((task, index) => (
              <Card key={task.id} className="border-muted">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Tarefa {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeLookaheadTask(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        value={task.date}
                        onChange={(e) => updateLookaheadTask(index, "date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Responsável</Label>
                      <Input
                        placeholder="Nome do responsável"
                        value={task.responsible}
                        onChange={(e) => updateLookaheadTask(index, "responsible", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      placeholder="Descreva a tarefa"
                      value={task.description}
                      onChange={(e) => updateLookaheadTask(index, "description", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Pré-requisitos</Label>
                    <Input
                      placeholder="O que precisa estar pronto antes"
                      value={task.prerequisites}
                      onChange={(e) => updateLookaheadTask(index, "prerequisites", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Risco</Label>
                    <Select value={task.risk} onValueChange={(v) => updateLookaheadTask(index, "risk", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixo">Baixo</SelectItem>
                        <SelectItem value="médio">Médio</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addLookaheadTask} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Tarefa
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Risks and Issues */}
        <AccordionItem value="risks" className="bg-card border border-border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="font-semibold">Riscos e Impedimentos ({formData.risksAndIssues.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {formData.risksAndIssues.map((risk, index) => (
              <Card key={risk.id} className="border-muted">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeRiskIssue(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={risk.type} onValueChange={(v) => updateRiskIssue(index, { type: v as any })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="risco">Risco</SelectItem>
                          <SelectItem value="impedimento">Impedimento</SelectItem>
                          <SelectItem value="problema">Problema</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Severidade</Label>
                      <Select value={risk.severity} onValueChange={(v) => updateRiskIssue(index, { severity: v as any })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="média">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="crítica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Título</Label>
                    <Input
                      placeholder="Título do risco/impedimento"
                      value={risk.title}
                      onChange={(e) => updateRiskIssue(index, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      placeholder="Descreva o risco ou impedimento"
                      value={risk.description}
                      onChange={(e) => updateRiskIssue(index, { description: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Plano de Ação</Label>
                    <Textarea
                      placeholder="O que será feito para mitigar/resolver"
                      value={risk.actionPlan}
                      onChange={(e) => updateRiskIssue(index, { actionPlan: e.target.value })}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Responsável</Label>
                      <Input
                        placeholder="Nome"
                        value={risk.owner}
                        onChange={(e) => updateRiskIssue(index, { owner: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Prazo</Label>
                      <Input
                        type="date"
                        value={risk.dueDate}
                        onChange={(e) => updateRiskIssue(index, { dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addRiskIssue} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Risco/Impedimento
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Client Decisions */}
        <AccordionItem value="decisions" className="bg-card border border-border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span className="font-semibold">Decisões do Cliente ({formData.clientDecisions.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {formData.clientDecisions.map((decision, index) => (
              <Card key={decision.id} className="border-muted">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Decisão {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeClientDecision(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      placeholder="Descreva a decisão necessária"
                      value={decision.description}
                      onChange={(e) => updateClientDecision(index, "description", e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Impacto se Atrasado</Label>
                    <Input
                      placeholder="O que acontece se não for decidido a tempo"
                      value={decision.impactIfDelayed}
                      onChange={(e) => updateClientDecision(index, "impactIfDelayed", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Prazo</Label>
                    <Input
                      type="date"
                      value={decision.dueDate}
                      onChange={(e) => updateClientDecision(index, "dueDate", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addClientDecision} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Decisão
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Incidents */}
        <AccordionItem value="incidents" className="bg-card border border-border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold">Ocorrências ({formData.incidents.length})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {formData.incidents.map((incident, index) => (
              <Card key={incident.id} className="border-muted">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Ocorrência {index + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeIncident(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        value={incident.occurrenceDate}
                        onChange={(e) => updateIncident(index, "occurrenceDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={incident.status} onValueChange={(v) => updateIncident(index, "status", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aberto">Aberto</SelectItem>
                          <SelectItem value="em andamento">Em Andamento</SelectItem>
                          <SelectItem value="resolvido">Resolvido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Ocorrência</Label>
                    <Textarea
                      placeholder="Descreva o que aconteceu"
                      value={incident.occurrence}
                      onChange={(e) => updateIncident(index, "occurrence", e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Causa</Label>
                    <Input
                      placeholder="O que causou a ocorrência"
                      value={incident.cause}
                      onChange={(e) => updateIncident(index, "cause", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ação Tomada</Label>
                    <Textarea
                      placeholder="O que foi feito para resolver"
                      value={incident.action}
                      onChange={(e) => updateIncident(index, "action", e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Impacto</Label>
                    <Input
                      placeholder="Qual o impacto na obra"
                      value={incident.impact}
                      onChange={(e) => updateIncident(index, "impact", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Previsão de Resolução</Label>
                    <Input
                      type="date"
                      value={incident.expectedResolutionDate}
                      onChange={(e) => updateIncident(index, "expectedResolutionDate", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addIncident} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Ocorrência
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Bottom Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Salvando..." : "Salvar Relatório"}
        </Button>
      </div>
    </div>
  );
};

export default WeeklyReportEditor;
