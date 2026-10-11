/**
 * Gaveta da atividade (Semana): tudo de uma atividade sem sair da grade.
 * Situação, data-limite e crítica · dias e quem fez · material · revisão
 * (aprovar / refazer) · custo previsto × real (só leitura: escritório preenche).
 */
import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Flame, PackageCheck, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { longDayLabel } from "@/lib/hojeDia";
import { OPS_MATERIAL_LABEL, OPS_REASON_LABEL, OPS_STATUS_LABEL } from "@/lib/opsLabels";
import { shortWho } from "@/lib/semanaPlan";
import type {
  OpsActivityView,
  OpsBlockReason,
  OpsMaterial,
  OpsMaterialStatus,
} from "@/infra/repositories/ops.repository";
import {
  useCreateOpsMaterial,
  useCreateOpsReview,
  useDeleteOpsMaterial,
  useOpsActivityAssignments,
  useOpsMaterials,
  useOpsReviews,
  useSetMaterialStatus,
  useUpdateOpsActivity,
} from "@/hooks/useOps";

const REASONS = Object.keys(OPS_REASON_LABEL) as OpsBlockReason[];
const MAT_STATUSES: OpsMaterialStatus[] = ["pendente", "comprado", "na_obra"];

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  activity: OpsActivityView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffNameById: ReadonlyMap<string, string>;
}

export function ActivityDrawer({ activity, open, onOpenChange, staffNameById }: Props) {
  const id = activity?.id ?? undefined;
  const status = activity?.status ?? "planejada";
  const { data: assignments = [] } = useOpsActivityAssignments(open ? id : undefined);
  const { data: materials = [] } = useOpsMaterials(open ? id : undefined);
  const { data: reviews = [] } = useOpsReviews(open ? id : undefined);
  const update = useUpdateOpsActivity();
  const review = useCreateOpsReview();

  const [blocking, setBlocking] = useState(false);
  const [refazendo, setRefazendo] = useState(false);
  const [refazerNotes, setRefazerNotes] = useState("");

  useEffect(() => {
    setBlocking(false);
    setRefazendo(false);
    setRefazerNotes("");
  }, [id, open]);

  if (!activity || !id) return null;

  const patch = (p: Parameters<typeof update.mutate>[0]["patch"], ok?: string) =>
    update.mutate(
      { id, patch: p },
      {
        onSuccess: () => ok && toast.success(ok),
        onError: () => toast.error("Não foi possível salvar."),
      },
    );

  const doReview = (result: "aprovado" | "refazer") =>
    review.mutate(
      { activity_id: id, result, notes: result === "refazer" ? refazerNotes.trim() : null },
      {
        onSuccess: () => {
          toast.success(result === "aprovado" ? "Atividade aprovada" : "Retrabalho criado na mesma etapa");
          setRefazendo(false);
        },
        onError: () => toast.error("Não foi possível registrar a revisão."),
      },
    );

  const open_ = !["aprovada", "refazer"].includes(status);
  const done = assignments.filter((a) => a.outcome === "feito").length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full space-y-6 sm:max-w-md">
        <SheetHeader className="space-y-1 pr-6 text-left">
          <SheetDescription>{activity.stage_name ?? "Sem etapa"}</SheetDescription>
          <SheetTitle className="text-lg leading-snug">{activity.title}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">{OPS_STATUS_LABEL[status]}</Badge>
            {status === "bloqueada" && activity.blocked_reason && (
              <span className="text-xs text-muted-foreground">{OPS_REASON_LABEL[activity.blocked_reason]}</span>
            )}
            {activity.is_critical && (
              <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                <Flame className="h-3 w-3" aria-hidden="true" />
                Crítica
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Situação */}
        {open_ && (
          <section aria-label="Situação" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {status !== "concluida" && status !== "bloqueada" && (
                <Button type="button" className="min-h-[44px]" onClick={() => patch({ status: "concluida" }, "Atividade concluída")}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Concluir
                </Button>
              )}
              {status === "bloqueada" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => patch({ status: "planejada", blocked_reason: null }, "Atividade desbloqueada")}
                >
                  Desbloquear
                </Button>
              ) : (
                status !== "concluida" && (
                  <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setBlocking((b) => !b)}>
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Bloquear
                  </Button>
                )
              )}
            </div>
            {blocking && (
              <div role="radiogroup" aria-label="Motivo do bloqueio" className="grid grid-cols-2 gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={false}
                    onClick={() => {
                      setBlocking(false);
                      patch({ status: "bloqueada", blocked_reason: r }, "Atividade bloqueada");
                    }}
                    className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {OPS_REASON_LABEL[r]}
                  </button>
                ))}
              </div>
            )}

            {status === "concluida" && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Ficou bom?</p>
                {!refazendo ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      className="min-h-[44px] bg-success text-success-foreground hover:bg-success/90"
                      disabled={review.isPending}
                      onClick={() => doReview("aprovado")}
                    >
                      Aprovar
                    </Button>
                    <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setRefazendo(true)}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Refazer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="refazer-notes">O que precisa ser refeito?</Label>
                    <Textarea
                      id="refazer-notes"
                      rows={2}
                      value={refazerNotes}
                      onChange={(e) => setRefazerNotes(e.target.value)}
                      placeholder="Ex.: caixa de tomada fora de nível"
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="min-h-[44px] flex-1" onClick={() => setRefazendo(false)}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="min-h-[44px] flex-1"
                        disabled={!refazerNotes.trim() || review.isPending}
                        onClick={() => doReview("refazer")}
                      >
                        Criar retrabalho
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Planejamento */}
        <section aria-label="Planejamento" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="act-critica" className="text-sm">
              Crítica para o prazo
            </Label>
            <Switch
              id="act-critica"
              checked={!!activity.is_critical}
              onCheckedChange={(v) => patch({ is_critical: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-limite" className="text-sm">
              Data-limite
            </Label>
            <Input
              id="act-limite"
              type="date"
              className="min-h-[44px]"
              defaultValue={activity.late_finish ?? ""}
              key={`${id}-${activity.late_finish ?? ""}`}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== (activity.late_finish ?? null)) patch({ late_finish: v }, "Data-limite salva");
              }}
            />
            <p className="text-xs text-muted-foreground">
              Sem data, vale o fim previsto da etapa no cronograma. Dia marcado depois do limite aparece com ⚠.
            </p>
          </div>
        </section>

        {/* Dias */}
        <section aria-labelledby="act-dias" className="space-y-2">
          <h3 id="act-dias" className="text-sm font-semibold">
            Dias · {done} de {assignments.length} feitos
          </h3>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dia marcado ainda.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{longDayLabel(a.work_date)}</span>
                    <span className="text-muted-foreground"> · {shortWho(a, staffNameById)}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      a.outcome === "feito" && "text-success",
                      a.outcome === "nao_feito" && "text-warning",
                      !a.outcome && "text-muted-foreground",
                    )}
                  >
                    {a.outcome === "feito"
                      ? "Feito"
                      : a.outcome === "nao_feito"
                        ? `Não feito${a.not_done_reason ? ` · ${OPS_REASON_LABEL[a.not_done_reason]}` : ""}`
                        : "Planejado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Material */}
        <MaterialsSection activityId={id} materials={materials} />

        {/* Custo */}
        <section aria-labelledby="act-custo" className="space-y-2">
          <h3 id="act-custo" className="text-sm font-semibold">
            Custo
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Previsto</dt>
              <dd className="font-medium tabular-nums">{brl(activity.planned_cost)}</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Real</dt>
              <dd className="font-medium tabular-nums">{brl(activity.actual_cost)}</dd>
            </div>
          </dl>
        </section>

        {/* Revisões */}
        {reviews.length > 0 && (
          <section aria-labelledby="act-revisoes" className="space-y-2">
            <h3 id="act-revisoes" className="text-sm font-semibold">
              Revisões
            </h3>
            <ul className="space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <span className={cn("font-medium", r.result === "aprovado" ? "text-success" : "text-warning")}>
                    {r.result === "aprovado" ? "Aprovado" : "Refazer"}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    {r.reviewed_by ? ` · ${staffNameById.get(r.reviewed_by) ?? ""}` : ""}
                  </span>
                  {r.notes && <p className="mt-1 text-foreground/80">{r.notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MaterialsSection({
  activityId,
  materials,
}: {
  activityId: string;
  materials: OpsMaterial[];
}) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [needed, setNeeded] = useState("");
  const create = useCreateOpsMaterial();
  const setStatus = useSetMaterialStatus();
  const remove = useDeleteOpsMaterial();

  const add = () => {
    const d = desc.trim();
    if (!d) return;
    const q = qty.trim() ? Number(qty.replace(",", ".")) : null;
    if (q != null && (!Number.isFinite(q) || q <= 0)) {
      toast.error("Quantidade inválida.");
      return;
    }
    create.mutate(
      { activity_id: activityId, description: d, quantity: q, unit: unit.trim() || null, needed_by: needed || null },
      {
        onSuccess: () => {
          setDesc("");
          setQty("");
          setUnit("");
          setNeeded("");
        },
        onError: () => toast.error("Não foi possível adicionar o material."),
      },
    );
  };

  const onSite = materials.filter((m) => m.status === "na_obra").length;

  return (
    <section aria-labelledby="act-material" className="space-y-2">
      <h3 id="act-material" className="flex items-center gap-1.5 text-sm font-semibold">
        <PackageCheck className="h-4 w-4" aria-hidden="true" />
        Material · {onSite} de {materials.length} na obra
      </h3>
      {materials.length > 0 && (
        <ul className="space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">{m.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.quantity != null ? `${m.quantity.toLocaleString("pt-BR")} ${m.unit ?? ""}`.trim() : null,
                      m.needed_by ? `até ${longDayLabel(m.needed_by)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground"
                  aria-label={`Remover ${m.description}`}
                  onClick={() => remove.mutate(m.id, { onError: () => toast.error("Não foi possível remover.") })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div role="radiogroup" aria-label={`Situação de ${m.description}`} className="mt-2 grid grid-cols-3 gap-1">
                {MAT_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={m.status === s}
                    onClick={() =>
                      m.status !== s &&
                      setStatus.mutate({ id: m.id, status: s }, { onError: () => toast.error("Não foi possível salvar.") })
                    }
                    className={cn(
                      "min-h-[36px] rounded-md border px-2 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      m.status === s
                        ? s === "na_obra"
                          ? "border-success/50 bg-success/10 text-success"
                          : "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {OPS_MATERIAL_LABEL[s]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <Input
          aria-label="Material"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Material (ex.: massa corrida)"
          className="min-h-[44px]"
          maxLength={160}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input aria-label="Quantidade" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qtd." className="min-h-[44px]" />
          <Input aria-label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Un." className="min-h-[44px]" maxLength={12} />
          <Input aria-label="Precisa estar na obra até" type="date" value={needed} onChange={(e) => setNeeded(e.target.value)} className="min-h-[44px]" />
        </div>
        <Button type="button" variant="outline" className="min-h-[44px] w-full" disabled={!desc.trim() || create.isPending} onClick={add}>
          Adicionar material
        </Button>
      </div>
    </section>
  );
}
