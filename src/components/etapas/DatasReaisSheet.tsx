/**
 * Gaveta "Datas reais" (equipe, celular): escolhe quando a etapa começou e
 * terminou. Atalhos para os dias mais comuns e calendário com dias de 44 px.
 * As regras (sem futuro, término depois do início) estão em `@/lib/datasReais`.
 */
import { useEffect, useMemo, useState } from "react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { parseISODate, toISODate } from "@/lib/hojeDia";
import { ddmm } from "@/lib/obrasPainel";
import {
  atalhosDeData,
  patchDoRascunho,
  validarRascunho,
  type CampoDataReal,
  type DatasReaisPatch,
  type EtapaDatas,
  type RascunhoDatas,
} from "@/lib/datasReais";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";

const L = equipeMobileLabels.datasReais;
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_NAME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface DatasReaisSheetProps {
  /** Etapa aberta; null fecha a gaveta. */
  etapa: EtapaDatas | null;
  /** Campo que abre selecionado. */
  campoInicial: CampoDataReal;
  hoje: string;
  subtitle?: string;
  onClose: () => void;
  onSave: (etapa: EtapaDatas, patch: DatasReaisPatch) => void;
}

export function DatasReaisSheet({ etapa, campoInicial, hoje, subtitle, onClose, onSave }: DatasReaisSheetProps) {
  const [campo, setCampo] = useState<CampoDataReal>(campoInicial);
  const [rascunho, setRascunho] = useState<RascunhoDatas>({ inicio: null, termino: null });
  const [mes, setMes] = useState<Date>(() => parseISODate(hoje));

  useEffect(() => {
    if (!etapa) return;
    const inicial = { inicio: etapa.actual_start, termino: etapa.actual_end };
    setCampo(campoInicial);
    setRascunho(inicial);
    setMes(parseISODate(inicial[campoInicial] ?? hoje));
    // Só ao abrir outra etapa: mudanças de datas vindas do servidor não
    // podem apagar o que a pessoa está escolhendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa?.id, campoInicial]);

  const atalhos = useMemo(() => atalhosDeData(hoje), [hoje]);
  const erro = validarRascunho(rascunho, hoje);
  const patch = etapa ? patchDoRascunho(etapa, rascunho) : {};
  const mudou = Object.keys(patch).length > 0;
  const atual = rascunho[campo];

  const escolher = (date: string | null) => setRascunho((r) => ({ ...r, [campo]: date }));
  const trocarCampo = (c: CampoDataReal) => {
    setCampo(c);
    const d = rascunho[c];
    if (d) setMes(parseISODate(d));
  };

  const atalhoLabel = (a: (typeof atalhos)[number]) =>
    a.id === "hoje" ? L.atalhos.hoje : a.id === "ontem" ? L.atalhos.ontem : WEEKDAY_NAME[parseISODate(a.date).getDay()];
  const atalhoDia = (date: string) => `${WEEKDAY_SHORT[parseISODate(date).getDay()]} ${ddmm(date)}`;

  return (
    <Sheet open={!!etapa} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-3xl p-0 pb-safe">
        <SheetHeader className="shrink-0 px-5 pb-3 pt-5 text-left">
          <SheetTitle className="text-lg font-bold">{L.title}</SheetTitle>
          <SheetDescription className="pr-8">
            {etapa?.description}
            {subtitle ? ` · ${subtitle}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3">
          <div role="radiogroup" aria-label={L.title} className="grid grid-cols-2 gap-2">
            {(["inicio", "termino"] as const).map((c) => {
              const on = campo === c;
              const value = rascunho[c];
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => trocarCampo(c)}
                  className={cn(
                    "flex !min-h-[56px] flex-col items-start justify-center rounded-xl border px-3.5 py-1.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary bg-primary/10" : "border-border bg-card",
                  )}
                >
                  <span className={cn("text-xs font-medium", on ? "text-primary" : "text-muted-foreground")}>
                    {c === "inicio" ? L.comecou : L.terminou}
                  </span>
                  <span className={cn("text-base font-semibold tabular-nums", value ? "text-foreground" : "text-muted-foreground")}>
                    {value ? ddmm(value) : L.semData}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {atalhos.map((a) => {
              const on = atual === a.date;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    escolher(a.date);
                    setMes(parseISODate(a.date));
                  }}
                  className={cn(
                    "flex !min-h-[52px] flex-col items-center justify-center rounded-xl border px-1 py-1 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
                  )}
                >
                  <span className="text-sm font-semibold">{atalhoLabel(a)}</span>
                  <span className={cn("text-xs tabular-nums", on ? "text-primary-foreground/90" : "text-muted-foreground")}>
                    {atalhoDia(a.date)}
                  </span>
                </button>
              );
            })}
          </div>

          <Calendar
            mode="single"
            locale={ptBR}
            month={mes}
            onMonthChange={setMes}
            selected={atual ? parseISODate(atual) : undefined}
            onSelect={(d) => d && escolher(toISODate(d))}
            disabled={{ after: parseISODate(hoje) }}
            toMonth={parseISODate(hoje)}
            showOutsideDays={false}
            className="p-0"
            classNames={{
              months: "flex flex-col",
              month: "space-y-2",
              caption: "relative flex h-11 items-center justify-center",
              caption_label: "text-base font-semibold capitalize",
              nav_button:
                "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-40",
              head_row: "grid grid-cols-7",
              head_cell: "text-center text-xs font-medium text-muted-foreground",
              row: "mt-1 grid grid-cols-7",
              cell: "flex items-center justify-center p-0 text-center",
              day: "inline-flex h-11 w-11 items-center justify-center rounded-full text-base tabular-nums text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100",
              day_today: "font-bold text-primary ring-1 ring-primary/40",
              day_selected: "bg-primary !text-primary-foreground ring-0",
              day_disabled: "text-muted-foreground opacity-40",
            }}
          />

          <p role="alert" aria-live="polite" className={cn("min-h-[20px] text-sm font-medium text-destructive", !erro && "invisible")}>
            {erro ? L.erros[erro] : ""}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
            disabled={!atual}
            onClick={() => escolher(null)}
          >
            {L.limpar}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
            disabled={!etapa || !mudou || !!erro}
            onClick={() => {
              if (!etapa || erro) return;
              onSave(etapa, patch);
              onClose();
            }}
          >
            {L.salvar(atual ? ddmm(atual) : null)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
