import { useState, useRef, useCallback } from "react";
import {
  Wand2,
  Upload,
  FileSpreadsheet,
  Loader2,
  CalendarDays,
  ShoppingCart,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { invokeFunction } from "@/infra/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface BudgetItem {
  description: string;
  quantity?: string;
  unit?: string;
  value?: string;
}

interface ScheduleActivity {
  description: string;
  estimatedDays: number;
  dependencies?: string[];
  notes?: string;
}

interface WeeklyScheduleItem {
  week: number;
  phase: string;
  activities: ScheduleActivity[];
}

interface PurchaseItem {
  item: string;
  category: string;
  quantity?: string;
  estimatedCost?: string;
  leadTimeDays: number;
  orderByWeek: number;
  neededByWeek: number;
  priority: "alta" | "media" | "baixa";
  notes?: string;
}

interface BudgetRiskAlert {
  type: string;
  severity: "alta" | "media" | "baixa";
  message: string;
  affectedItems?: string[];
  recommendation: string;
}

interface GeneratedPlan {
  weeklySchedule: WeeklyScheduleItem[];
  purchaseList: PurchaseItem[];
  budgetRiskAlerts?: BudgetRiskAlert[];
  summary: {
    totalWeeks: number;
    bufferWeeks?: number;
    totalActivities: number;
    totalPurchaseItems: number;
    budgetConcentration?: string;
    criticalPath?: string[];
    recommendations?: string[];
  };
}

interface AIScheduleGeneratorProps {
  projectId: string;
  projectName: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
}

export function AIScheduleGenerator({
  projectId,
  projectName,
  plannedStartDate,
  plannedEndDate,
}: AIScheduleGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [startDate, setStartDate] = useState(plannedStartDate || "");
  const [endDate, setEndDate] = useState(plannedEndDate || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [activeTab, setActiveTab] = useState<
    "schedule" | "purchases" | "alerts"
  >("schedule");
  const [pdfFile, setPdfFile] = useState<{
    name: string;
    base64: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        setPdfFile({ name: file.name, base64 });
        setBudgetItems([]);
        toast.success(
          `PDF "${file.name}" carregado — a IA irá extrair os itens`,
        );
      };
      reader.onerror = () => toast.error("Erro ao ler PDF");
      reader.readAsArrayBuffer(file);
      return;
    }

    setPdfFile(null);

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const items = mapRowsToItems(
            results.data as Record<string, string>[],
          );
          setBudgetItems(items);
          toast.success(`${items.length} itens importados`);
        },
        error: () => toast.error("Erro ao ler CSV"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
          const items = mapRowsToItems(rows);
          setBudgetItems(items);
          toast.success(`${items.length} itens importados`);
        } catch {
          toast.error("Erro ao ler planilha");
        }
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const mapRowsToItems = (rows: Record<string, string>[]): BudgetItem[] => {
    return rows
      .map((row) => {
        const keys = Object.keys(row);
        const descKey =
          keys.find((k) => /descri|item|servi|atividade|nome/i.test(k)) ||
          keys[0];
        const qtyKey = keys.find((k) => /qtd|quant/i.test(k));
        const unitKey = keys.find((k) => /und|unid|un\b/i.test(k));
        const valKey = keys.find((k) =>
          /valor|custo|preco|total|preço/i.test(k),
        );

        const desc = row[descKey]?.toString().trim();
        if (!desc) return null;

        return {
          description: desc,
          quantity: qtyKey ? row[qtyKey]?.toString() : undefined,
          unit: unitKey ? row[unitKey]?.toString() : undefined,
          value: valKey ? row[valKey]?.toString() : undefined,
        };
      })
      .filter(Boolean) as BudgetItem[];
  };

  const hasInput = budgetItems.length > 0 || pdfFile !== null;

  const [generationProgress, setGenerationProgress] = useState("");

  const pollJobStatus = useCallback(
    async (jobId: string): Promise<GeneratedPlan> => {
      const maxAttempts = 90; // ~3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        const { data, error } = await supabase
          .from("schedule_jobs")
          .select("status, result, error_message")
          .eq("id", jobId)
          .single();

        if (error) throw new Error("Erro ao verificar status");

        if (data.status === "completed" && data.result) {
          return data.result as unknown as GeneratedPlan;
        }
        if (data.status === "failed") {
          throw new Error(data.error_message || "Falha na geração");
        }

        // Update progress message
        if (i < 5) setGenerationProgress("Analisando orçamento...");
        else if (i < 15)
          setGenerationProgress("Planejando sequenciamento técnico...");
        else if (i < 30)
          setGenerationProgress("Calculando lead times e compras...");
        else setGenerationProgress("Finalizando cronograma...");
      }
      throw new Error("Tempo limite excedido. Tente novamente.");
    },
    [],
  );

  const handleGenerate = async () => {
    if (!hasInput) {
      toast.error("Importe um arquivo de orçamento primeiro");
      return;
    }

    setIsGenerating(true);
    setPlan(null);
    setGenerationProgress("Iniciando geração...");

    try {
      const payload: Record<string, unknown> = {
        projectId,
        projectName,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      if (pdfFile) {
        payload.budgetFileBase64 = pdfFile.base64;
        payload.budgetFileName = pdfFile.name;
      } else {
        payload.budgetItems = budgetItems;
      }

      const { data, error } = await invokeFunction<{
        jobId: string;
        status: string;
      }>("generate-schedule", payload);

      if (error)
        throw new Error(
          typeof error === "string" ? error : error.message || "Erro ao gerar",
        );
      if (!data?.jobId) throw new Error("Resposta vazia");

      // Poll for results
      const result = await pollJobStatus(data.jobId);

      setPlan(result);
      setActiveTab("schedule");
      toast.success("Cronograma e lista de compras gerados!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cronograma");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleReset = () => {
    setBudgetItems([]);
    setPdfFile(null);
    setPlan(null);
    setStartDate(plannedStartDate || "");
    setEndDate(plannedEndDate || "");
  };

  const priorityColors: Record<string, string> = {
    alta: "bg-destructive/15 text-destructive border-destructive/30",
    media: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    baixa: "bg-muted text-muted-foreground border-muted",
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Wand2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Gerar com IA</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Gerador de Cronograma Inteligente
            </DialogTitle>
            <DialogDescription>
              Importe o orçamento da obra e a IA vai sugerir o melhor cronograma
              semanal e lista de compras.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {!plan ? (
              <div className="space-y-5 py-2">
                {/* Upload area */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    1. Importe o orçamento (PDF, Excel ou CSV)
                  </Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5",
                      hasInput
                        ? "border-primary/30 bg-primary/5"
                        : "border-border",
                    )}
                    onClick={() => fileRef.current?.click()}
                  >
                    {pdfFile ? (
                      <div className="space-y-1">
                        <FileSpreadsheet className="h-8 w-8 text-primary mx-auto" />
                        <p className="text-sm font-medium">{pdfFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          PDF carregado — a IA extrairá os itens automaticamente
                        </p>
                      </div>
                    ) : budgetItems.length > 0 ? (
                      <div className="space-y-1">
                        <FileSpreadsheet className="h-8 w-8 text-primary mx-auto" />
                        <p className="text-sm font-medium">
                          {budgetItems.length} itens importados
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Clique para trocar o arquivo
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Clique ou arraste seu arquivo aqui
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Aceita .pdf, .xlsx, .xls ou .csv
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) parseFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Preview imported items */}
                {budgetItems.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Itens encontrados:
                    </Label>
                    <ScrollArea className="max-h-40 border rounded-md">
                      <div className="p-2 space-y-1">
                        {budgetItems.slice(0, 20).map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50"
                          >
                            <span className="truncate flex-1">
                              {item.description}
                            </span>
                            {item.value && (
                              <span className="text-muted-foreground ml-2 shrink-0">
                                R$ {item.value}
                              </span>
                            )}
                          </div>
                        ))}
                        {budgetItems.length > 20 && (
                          <p className="text-xs text-muted-foreground text-center py-1">
                            +{budgetItems.length - 20} itens...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Dates */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    2. Datas da obra
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Data de início
                      </Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Data de término
                      </Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {startDate && endDate && (
                    <p className="text-xs text-muted-foreground">
                      O cronograma será distribuído dentro deste intervalo.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Results */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3">
                  <Card className="p-3">
                    <div className="text-2xl font-bold text-primary">
                      {plan.summary.totalWeeks}
                    </div>
                    <p className="text-xs text-muted-foreground">Semanas</p>
                  </Card>
                  <Card className="p-3">
                    <div className="text-2xl font-bold text-primary">
                      {plan.summary.totalActivities}
                    </div>
                    <p className="text-xs text-muted-foreground">Atividades</p>
                  </Card>
                  <Card className="p-3">
                    <div className="text-2xl font-bold text-primary">
                      {plan.summary.totalPurchaseItems}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Itens de Compra
                    </p>
                  </Card>
                  {plan.summary.bufferWeeks != null && (
                    <Card className="p-3">
                      <div className="text-2xl font-bold text-amber-600">
                        {plan.summary.bufferWeeks}
                      </div>
                      <p className="text-xs text-muted-foreground">Buffer</p>
                    </Card>
                  )}
                </div>

                {plan.summary.budgetConcentration && (
                  <div className="px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground mb-3">
                    <span className="font-medium text-foreground">
                      Concentração orçamentária:
                    </span>{" "}
                    {plan.summary.budgetConcentration}
                  </div>
                )}

                {/* Tab toggle */}
                <div className="flex gap-1 bg-muted rounded-lg p-1 mb-3">
                  <button
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      activeTab === "schedule"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setActiveTab("schedule")}
                  >
                    <CalendarDays className="h-3.5 w-3.5" /> Cronograma
                  </button>
                  <button
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      activeTab === "purchases"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setActiveTab("purchases")}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Compras
                  </button>
                  {plan.budgetRiskAlerts &&
                    plan.budgetRiskAlerts.length > 0 && (
                      <button
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                          activeTab === "alerts"
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setActiveTab("alerts")}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Alertas
                        <Badge
                          variant="destructive"
                          className="text-[10px] h-4 px-1.5"
                        >
                          {plan.budgetRiskAlerts.length}
                        </Badge>
                      </button>
                    )}
                </div>

                <ScrollArea className="flex-1 pr-2">
                  {activeTab === "schedule" ? (
                    <div className="space-y-2 pb-4">
                      {plan.weeklySchedule.map((week) => (
                        <WeekCard key={week.week} week={week} />
                      ))}
                    </div>
                  ) : activeTab === "purchases" ? (
                    <div className="space-y-2 pb-4">
                      {plan.purchaseList.map((purchase, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card text-sm"
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {purchase.item}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-5",
                                  priorityColors[purchase.priority],
                                )}
                              >
                                {purchase.priority}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span>{purchase.category}</span>
                              {purchase.quantity && (
                                <span>Qtd: {purchase.quantity}</span>
                              )}
                              {purchase.estimatedCost && (
                                <span>~{purchase.estimatedCost}</span>
                              )}
                            </div>
                            <div className="flex gap-3 text-xs">
                              <span className="text-amber-600">
                                Pedir: Sem. {purchase.orderByWeek}
                              </span>
                              <span className="text-primary">
                                Usar: Sem. {purchase.neededByWeek}
                              </span>
                              <span className="text-muted-foreground">
                                {purchase.leadTimeDays}d entrega
                              </span>
                            </div>
                            {purchase.notes && (
                              <p className="text-xs text-muted-foreground italic">
                                {purchase.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2 pb-4">
                      {(plan.budgetRiskAlerts || []).map((alert, i) => {
                        const severityColors: Record<string, string> = {
                          alta: "border-destructive/40 bg-destructive/5",
                          media: "border-amber-500/40 bg-amber-500/5",
                          baixa: "border-muted bg-muted/30",
                        };
                        return (
                          <div
                            key={i}
                            className={cn(
                              "p-3 rounded-lg border text-sm",
                              severityColors[alert.severity],
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <AlertTriangle
                                className={cn(
                                  "h-4 w-4",
                                  alert.severity === "alta"
                                    ? "text-destructive"
                                    : "text-amber-600",
                                )}
                              />
                              <span className="font-medium text-xs">
                                {alert.message}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-5 ml-auto",
                                  priorityColors[alert.severity],
                                )}
                              >
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground ml-6">
                              💡 {alert.recommendation}
                            </p>
                            {alert.affectedItems &&
                              alert.affectedItems.length > 0 && (
                                <p className="text-[11px] text-muted-foreground ml-6 mt-1">
                                  Itens: {alert.affectedItems.join(", ")}
                                </p>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Recommendations */}
                {plan.summary.recommendations &&
                  plan.summary.recommendations.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 mb-1">
                        <Lightbulb className="h-4 w-4" />
                        Recomendações
                      </div>
                      <ul className="space-y-0.5">
                        {plan.summary.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-amber-700/80">
                            • {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {plan ? (
              <>
                <Button variant="outline" onClick={handleReset}>
                  Novo Orçamento
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isGenerating}
                >
                  Cancelar
                </Button>
                {isGenerating ? (
                  <div className="flex items-center gap-3 flex-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {generationProgress || "Gerando..."}
                      </p>
                      <Progress value={undefined} className="h-1.5" />
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleGenerate}
                    disabled={!hasInput}
                    className="gap-1.5"
                  >
                    <Wand2 className="h-4 w-4" />
                    Gerar Cronograma
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WeekCard({ week }: { week: WeeklyScheduleItem }) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
            Sem. {week.week}
          </Badge>
          <span className="text-sm font-medium">{week.phase}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {week.activities.length} atividades
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1">
          {week.activities.map((act, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-md border-l-2 border-primary/30 bg-muted/30 text-sm"
            >
              <div className="flex-1 space-y-0.5">
                <p className="font-medium text-xs">{act.description}</p>
                <div className="flex gap-2 text-[11px] text-muted-foreground">
                  <span>{act.estimatedDays} dia(s)</span>
                  {act.dependencies && act.dependencies.length > 0 && (
                    <span>Depende de: {act.dependencies.join(", ")}</span>
                  )}
                </div>
                {act.notes && (
                  <p className="text-[11px] text-muted-foreground italic">
                    {act.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
