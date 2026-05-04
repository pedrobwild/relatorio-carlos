import { useState, useMemo } from "react";
import { LayoutTemplate, ChevronDown, ChevronUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type {
  ProjectTemplate,
  TemplateActivity,
  TemplateCustomField,
} from "@/hooks/useProjectTemplates";
import { addBusinessDays } from "@/lib/businessDays";
import type { FormData } from "./types";

interface TemplateSelectorCardProps {
  templates: ProjectTemplate[];
  selectedTemplate: ProjectTemplate | null;
  onSelectTemplate: (t: ProjectTemplate | null) => void;
  formData: FormData;
  onFormChange: (field: keyof FormData, value: string | boolean) => void;
  customFieldValues: Record<string, string>;
  onCustomFieldChange: (values: Record<string, string>) => void;
}

export function TemplateSelectorCard({
  templates,
  selectedTemplate,
  onSelectTemplate,
  formData,
  onFormChange,
  customFieldValues,
  onCustomFieldChange,
}: TemplateSelectorCardProps) {
  const { toast } = useToast();
  const [showActivityPreview, setShowActivityPreview] = useState(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] =
    useState("__all__");

  const templateTotalDays = useMemo(() => {
    if (!selectedTemplate?.default_activities) return 0;
    return (selectedTemplate.default_activities as TemplateActivity[]).reduce(
      (s, a) => s + a.durationDays,
      0,
    );
  }, [selectedTemplate]);

  const cats = useMemo(() => {
    return [...new Set(templates.map((t) => t.category || "geral"))].sort();
  }, [templates]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-body">
          <LayoutTemplate className="h-5 w-5" />
          Template
        </CardTitle>
        <CardDescription>
          Selecione um template para preencher automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cats.length > 1 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            <Badge
              variant={
                templateCategoryFilter === "__all__" ? "default" : "outline"
              }
              className="cursor-pointer"
              onClick={() => setTemplateCategoryFilter("__all__")}
            >
              Todos
            </Badge>
            {cats.map((c) => (
              <Badge
                key={c}
                variant={templateCategoryFilter === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTemplateCategoryFilter(c)}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Badge>
            ))}
          </div>
        )}
        <Select
          onValueChange={(id) => {
            const tpl = templates.find((t) => t.id === id);
            if (tpl) {
              onSelectTemplate(tpl);
              setShowActivityPreview(false);
              onFormChange("is_project_phase", tpl.is_project_phase);
              if (tpl.default_contract_value)
                onFormChange(
                  "contract_value",
                  tpl.default_contract_value.toString(),
                );
              if (
                formData.planned_start_date &&
                Array.isArray(tpl.default_activities) &&
                tpl.default_activities.length > 0
              ) {
                const total = (
                  tpl.default_activities as TemplateActivity[]
                ).reduce((s, a) => s + a.durationDays, 0);
                if (total > 0) {
                  const start = new Date(
                    formData.planned_start_date + "T00:00:00",
                  );
                  const end = addBusinessDays(start, total - 1);
                  const y = end.getFullYear();
                  const m = (end.getMonth() + 1).toString().padStart(2, "0");
                  const d = end.getDate().toString().padStart(2, "0");
                  onFormChange("planned_end_date", `${y}-${m}-${d}`);
                }
              }
              toast({ title: `Template "${tpl.name}" aplicado` });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha um template (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {templates
              .filter(
                (t) =>
                  templateCategoryFilter === "__all__" ||
                  (t.category || "geral") === templateCategoryFilter,
              )
              .map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.description ? ` — ${t.description}` : ""}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {selectedTemplate &&
          Array.isArray(selectedTemplate.default_activities) &&
          selectedTemplate.default_activities.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {selectedTemplate.default_activities.length} atividades
                </Badge>
                <Badge variant="outline">{templateTotalDays} dias úteis</Badge>
                {selectedTemplate.default_activities.reduce(
                  (s, a) => s + (a as TemplateActivity).weight,
                  0,
                ) > 0 && (
                  <Badge variant="outline">
                    {selectedTemplate.default_activities.reduce(
                      (s, a) => s + (a as TemplateActivity).weight,
                      0,
                    )}
                    % peso total
                  </Badge>
                )}
              </div>

              {/* Mini-Gantt */}
              <div className="rounded-lg border p-3 mt-1 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Timeline estimada
                </p>
                <div className="space-y-1">
                  {(() => {
                    const acts =
                      selectedTemplate.default_activities as TemplateActivity[];
                    const cumDays: number[] = [];
                    let acc = 0;
                    acts.forEach((a) => {
                      cumDays.push(acc);
                      acc += a.durationDays;
                    });
                    const total = acc;
                    return acts.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 group/bar"
                      >
                        <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 h-4 relative rounded-sm overflow-hidden bg-muted">
                          <div
                            className="absolute top-0 h-full rounded-sm bg-primary/60 group-hover/bar:bg-primary/80 transition-colors"
                            style={{
                              left: `${(cumDays[i] / total) * 100}%`,
                              width: `${Math.max((act.durationDays / total) * 100, 2)}%`,
                            }}
                            title={`${act.description} — ${act.durationDays}d`}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    Dia 1
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Dia {templateTotalDays}
                  </span>
                </div>
              </div>

              <Collapsible
                open={showActivityPreview}
                onOpenChange={setShowActivityPreview}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-7 text-xs px-2"
                  >
                    {showActivityPreview ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {showActivityPreview ? "Ocultar" : "Ver"} detalhes
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-lg border overflow-hidden mt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Atividade</TableHead>
                          <TableHead className="text-xs w-16 text-right">
                            Dias
                          </TableHead>
                          <TableHead className="text-xs w-16 text-right">
                            Peso
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(
                          selectedTemplate.default_activities as TemplateActivity[]
                        ).map((act, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="text-sm">
                              {act.description}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {act.durationDays}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {act.weight}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Custom Fields */}
              {selectedTemplate.custom_fields &&
                (selectedTemplate.custom_fields as TemplateCustomField[])
                  .length > 0 && (
                  <div className="space-y-3 mt-3 p-3 rounded-lg border bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">
                      Campos do template
                    </p>
                    {(
                      selectedTemplate.custom_fields as TemplateCustomField[]
                    ).map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-sm">
                          {field.label} {field.required && "*"}
                        </Label>
                        {field.type === "select" && field.options ? (
                          <Select
                            value={customFieldValues[field.key] ?? ""}
                            onValueChange={(v) =>
                              onCustomFieldChange({
                                ...customFieldValues,
                                [field.key]: v,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === "number" ? "number" : "text"}
                            value={customFieldValues[field.key] ?? ""}
                            onChange={(e) =>
                              onCustomFieldChange({
                                ...customFieldValues,
                                [field.key]: e.target.value,
                              })
                            }
                            placeholder={field.label}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
