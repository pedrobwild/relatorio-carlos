/**
 * Gaveta lateral do Cronograma interno: tudo o que não cabe na linha
 * (descrição, etapa, descrição detalhada, observações, predecessoras,
 * responsável, prestador, peso e datas previstas).
 *
 * Serve para criar (item novo ou micro-etapa) e para editar. Sem permissão
 * de edição, abre só para leitura.
 */
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InternalScheduleItemWithRefs } from "@/infra/repositories/internalSchedule.repository";
import type { StaffUser } from "@/hooks/useStaffUsers";
import type { PrestadorOption } from "@/hooks/useFornecedoresPrestadores";
import { rangeLabel } from "@/lib/internalSchedule";
import {
  draftFrom,
  normalizeDraft,
  type InternalItemDraft,
  type InternalItemValues,
  type SheetMode,
} from "./internalItemDraft";

export type { InternalItemValues, SheetMode } from "./internalItemDraft";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SheetMode | null;
  /** Todos os itens da obra (para o seletor de predecessoras). */
  items: readonly InternalScheduleItemWithRefs[];
  staff: readonly StaffUser[];
  prestadores: readonly PrestadorOption[];
  /** Etapas já usadas na obra (sugestões). */
  etapas: readonly string[];
  canEdit: boolean;
  saving: boolean;
  onSubmit: (values: InternalItemValues) => Promise<void> | void;
}

export function InternalItemSheet({
  open,
  onOpenChange,
  mode,
  items,
  staff,
  prestadores,
  etapas,
  canEdit,
  saving,
  onSubmit,
}: Props) {
  const editing = mode?.kind === "edit" ? mode.item : null;
  const parent = mode?.kind === "create" ? mode.parent : editing?.parent_id ? items.find((i) => i.id === editing.parent_id) ?? null : null;
  const [draft, setDraft] = useState<InternalItemDraft>(() => draftFrom(null));
  const [error, setError] = useState<string | null>(null);

  const modeKey = mode ? (mode.kind === "edit" ? `e:${mode.item.id}` : `c:${mode.parent?.id ?? ""}`) : "";
  useEffect(() => {
    if (!open || !mode) return;
    setDraft(mode.kind === "edit" ? draftFrom(mode.item) : draftFrom(null, mode.defaults));
    setError(null);
    // Recomeça o rascunho só quando a gaveta abre para outro item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, modeKey]);

  // Predecessoras: qualquer item da obra menos ele mesmo e as micro-etapas dele.
  const predecessorOptions = useMemo(() => {
    const selfId = editing?.id;
    return items.filter((i) => i.id !== selfId && (!selfId || i.parent_id !== selfId));
  }, [items, editing?.id]);

  // Responsável/prestador atuais continuam visíveis mesmo fora das listas (ex.: inativo).
  const staffOptions = useMemo(() => {
    const list = [...staff];
    const current = editing?.responsible;
    if (current && !list.some((u) => u.id === current.id)) {
      list.unshift({ id: current.id, nome: current.nome, email: "", perfil: "" });
    }
    return list;
  }, [staff, editing?.responsible]);
  const prestadorOptions = useMemo(() => {
    const list = [...prestadores];
    const current = editing?.fornecedor;
    if (current && !list.some((p) => p.id === current.id)) {
      list.unshift({ id: current.id, nome: current.nome, categoria: null, status: "" });
    }
    return list;
  }, [prestadores, editing?.fornecedor]);

  const set = <K extends keyof InternalItemDraft>(key: K, value: InternalItemDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const togglePredecessor = (id: string, checked: boolean) =>
    setDraft((d) => ({
      ...d,
      predecessor_ids: checked ? [...d.predecessor_ids, id] : d.predecessor_ids.filter((p) => p !== id),
    }));

  const submit = async () => {
    const res = normalizeDraft(draft);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setError(null);
    await onSubmit(res.values);
  };

  const readOnly = !canEdit;
  const title =
    mode?.kind === "create" ? (mode.parent ? "Nova micro-etapa" : "Novo item") : readOnly ? "Detalhes do item" : "Editar item";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-border p-4 pr-10 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {parent ? `Micro-etapa de “${parent.description}”` : "Cronograma interno — o cliente não vê."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex-1 space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset disabled={readOnly || saving} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="isi-description">Descrição</Label>
              <Input
                id="isi-description"
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="isi-start">Início previsto</Label>
                <Input id="isi-start" type="date" value={draft.planned_start} onChange={(e) => set("planned_start", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="isi-end">Fim previsto</Label>
                <Input id="isi-end" type="date" value={draft.planned_end} onChange={(e) => set("planned_end", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="isi-etapa">Etapa</Label>
                <Input
                  id="isi-etapa"
                  value={draft.etapa}
                  onChange={(e) => set("etapa", e.target.value)}
                  list="isi-etapas"
                  placeholder="Ex.: Elétrica"
                  autoComplete="off"
                />
                <datalist id="isi-etapas">
                  {etapas.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="isi-weight">Peso (%)</Label>
                <Input
                  id="isi-weight"
                  inputMode="decimal"
                  value={draft.weight}
                  onChange={(e) => set("weight", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isi-responsible">Responsável</Label>
              <Select
                value={draft.responsible_user_id ?? NONE}
                onValueChange={(v) => set("responsible_user_id", v === NONE ? null : v)}
                disabled={readOnly || saving}
              >
                <SelectTrigger id="isi-responsible">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {staffOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isi-fornecedor">Prestador</Label>
              <Select
                value={draft.fornecedor_id ?? NONE}
                onValueChange={(v) => set("fornecedor_id", v === NONE ? null : v)}
                disabled={readOnly || saving}
              >
                <SelectTrigger id="isi-fornecedor">
                  <SelectValue placeholder="Sem prestador" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NONE}>Sem prestador</SelectItem>
                  {prestadorOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.categoria ? <span className="text-muted-foreground"> · {p.categoria}</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isi-detailed">Descrição detalhada</Label>
              <Textarea
                id="isi-detailed"
                rows={3}
                value={draft.detailed_description}
                onChange={(e) => set("detailed_description", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="isi-notes">Observações da equipe</Label>
              <Textarea id="isi-notes" rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Predecessoras</p>
              {predecessorOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum outro item na obra.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2" aria-label="Predecessoras">
                  {predecessorOptions.map((p) => {
                    const id = `isi-pred-${p.id}`;
                    return (
                      <li key={p.id} className="flex items-start gap-2">
                        <Checkbox
                          id={id}
                          checked={draft.predecessor_ids.includes(p.id)}
                          onCheckedChange={(c) => togglePredecessor(p.id, c === true)}
                          className="mt-0.5"
                        />
                        <label htmlFor={id} className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                          {p.parent_id ? "↳ " : ""}
                          {p.description}
                          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
                            {rangeLabel(p.planned_start, p.planned_end)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </form>

        <SheetFooter className="gap-2 border-t border-border p-4 sm:justify-between">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button type="button" className="min-h-[44px]" onClick={() => void submit()} disabled={saving}>
              {saving ? "Salvando…" : mode?.kind === "create" ? "Adicionar" : "Salvar"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
