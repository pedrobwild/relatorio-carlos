import { Plus, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activityTemplateSets } from "@/data/activityTemplates";
import {
  CATEGORIES,
  totalDays,
  totalWeight,
  type FormState,
  type ActivityItem,
} from "./types";

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  isSaving: boolean;
  onPresetChange: (presetId: string) => void;
  onUpdateActivity: (
    idx: number,
    field: keyof ActivityItem,
    value: string | number,
  ) => void;
  onAddActivity: () => void;
  onRemoveActivity: (idx: number) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: () => void;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  onSave,
  isSaving,
  onPresetChange,
  onUpdateActivity,
  onAddActivity,
  onRemoveActivity,
  onDragStart,
  onDragOver,
  onDrop,
}: TemplateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar Template" : "Novo Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nome *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Ex: Reforma Studio Padrão"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-value">Valor padrão (R$)</Label>
              <Input
                id="tpl-value"
                type="number"
                step="0.01"
                value={form.default_contract_value}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    default_contract_value: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Textarea
              id="tpl-desc"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Descreva quando usar este template..."
              rows={2}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="tpl-phase" className="text-sm font-medium">
                  Fase de projeto
                </Label>
                <p className="text-xs text-muted-foreground">
                  Obra em fase de aprovação
                </p>
              </div>
              <Switch
                id="tpl-phase"
                checked={form.is_project_phase}
                onCheckedChange={(v) =>
                  setForm((p) => ({ ...p, is_project_phase: v }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Activities section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Cronograma padrão</Label>
              <Select
                value={form.selected_activity_template}
                onValueChange={onPresetChange}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecionar base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {activityTemplateSets.map((at) => (
                    <SelectItem key={at.id} value={at.id}>
                      {at.emoji} {at.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">✏️ Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.selected_activity_template === "__custom__" ? (
              <div className="space-y-2">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8" />
                        <TableHead className="text-xs">Atividade</TableHead>
                        <TableHead className="text-xs w-24">Etapa</TableHead>
                        <TableHead className="text-xs w-20">Dias</TableHead>
                        <TableHead className="text-xs w-20">Peso %</TableHead>
                        <TableHead className="text-xs w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.custom_activities.map((act, i) => (
                        <TableRow
                          key={i}
                          draggable
                          onDragStart={() => onDragStart(i)}
                          onDragOver={(e) => onDragOver(e, i)}
                          onDrop={onDrop}
                          className="cursor-move"
                        >
                          <TableCell className="p-1 w-8">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={act.description}
                              onChange={(e) =>
                                onUpdateActivity(
                                  i,
                                  "description",
                                  e.target.value,
                                )
                              }
                              placeholder="Descrição..."
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={act.etapa || ""}
                              onChange={(e) =>
                                onUpdateActivity(i, "etapa", e.target.value)
                              }
                              placeholder="Etapa"
                              className="h-8 text-sm w-24"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={act.durationDays}
                              onChange={(e) =>
                                onUpdateActivity(
                                  i,
                                  "durationDays",
                                  parseInt(e.target.value, 10) || 1,
                                )
                              }
                              className="h-8 text-sm w-16"
                              min={1}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={act.weight}
                              onChange={(e) =>
                                onUpdateActivity(
                                  i,
                                  "weight",
                                  parseInt(e.target.value, 10) || 0,
                                )
                              }
                              className="h-8 text-sm w-16"
                              min={0}
                              max={100}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => onRemoveActivity(i)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddActivity}
                    className="gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Atividade
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Total: {totalDays(form.custom_activities)}d ·{" "}
                      {totalWeight(form.custom_activities)}%
                    </span>
                    {form.custom_activities.length > 0 &&
                      totalWeight(form.custom_activities) !== 100 && (
                        <span className="text-xs text-amber-600">
                          ⚠ Peso total ≠ 100%
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ) : form.selected_activity_template &&
              form.selected_activity_template !== "__none__" ? (
              <div className="rounded-lg border p-3 bg-muted/30">
                {(() => {
                  const preset = activityTemplateSets.find(
                    (a) => a.id === form.selected_activity_template,
                  );
                  if (!preset) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {preset.emoji} {preset.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {preset.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {preset.activities.length} atividades ·{" "}
                        {totalDays(preset.activities)}d ·{" "}
                        {totalWeight(preset.activities)}% peso total
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>

          {/* Custom Fields Editor */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campos customizados</Label>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    custom_fields: [
                      ...p.custom_fields,
                      { key: "", label: "", type: "text" as const },
                    ],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" /> Campo
              </Button>
            </div>
            {form.custom_fields.length > 0 && (
              <div className="space-y-2">
                {form.custom_fields.map((field, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-2.5">
                    <div className="flex gap-2 items-start">
                      <Input
                        value={field.key}
                        onChange={(e) => {
                          const updated = [...form.custom_fields];
                          updated[i] = {
                            ...updated[i],
                            key: e.target.value
                              .replace(/\s+/g, "_")
                              .toLowerCase(),
                          };
                          setForm((p) => ({ ...p, custom_fields: updated }));
                        }}
                        placeholder="chave"
                        className="h-8 text-sm w-24"
                      />
                      <Input
                        value={field.label}
                        onChange={(e) => {
                          const updated = [...form.custom_fields];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setForm((p) => ({ ...p, custom_fields: updated }));
                        }}
                        placeholder="Rótulo"
                        className="h-8 text-sm flex-1"
                      />
                      <Select
                        value={field.type}
                        onValueChange={(v) => {
                          const updated = [...form.custom_fields];
                          updated[i] = {
                            ...updated[i],
                            type: v as "text" | "number" | "select",
                            options:
                              v === "select"
                                ? (updated[i].options ?? [""])
                                : undefined,
                          };
                          setForm((p) => ({ ...p, custom_fields: updated }));
                        }}
                      >
                        <SelectTrigger className="h-8 w-24 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="select">Seleção</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={field.required ?? false}
                          onChange={(e) => {
                            const updated = [...form.custom_fields];
                            updated[i] = {
                              ...updated[i],
                              required: e.target.checked,
                            };
                            setForm((p) => ({ ...p, custom_fields: updated }));
                          }}
                          className="h-3.5 w-3.5"
                          title="Obrigatório"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          Req
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            custom_fields: p.custom_fields.filter(
                              (_, j) => j !== i,
                            ),
                          }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {field.type === "select" && (
                      <div className="pl-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Opções:
                        </p>
                        {(field.options ?? [""]).map((opt, oi) => (
                          <div key={oi} className="flex gap-1 items-center">
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const updated = [...form.custom_fields];
                                const opts = [...(updated[i].options ?? [""])];
                                opts[oi] = e.target.value;
                                updated[i] = { ...updated[i], options: opts };
                                setForm((p) => ({
                                  ...p,
                                  custom_fields: updated,
                                }));
                              }}
                              placeholder={`Opção ${oi + 1}`}
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                const updated = [...form.custom_fields];
                                const opts = (
                                  updated[i].options ?? [""]
                                ).filter((_, j) => j !== oi);
                                updated[i] = {
                                  ...updated[i],
                                  options: opts.length ? opts : [""],
                                };
                                setForm((p) => ({
                                  ...p,
                                  custom_fields: updated,
                                }));
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => {
                            const updated = [...form.custom_fields];
                            updated[i] = {
                              ...updated[i],
                              options: [...(updated[i].options ?? []), ""],
                            };
                            setForm((p) => ({ ...p, custom_fields: updated }));
                          }}
                        >
                          <Plus className="h-3 w-3" /> Opção
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={!form.name.trim() || isSaving}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
