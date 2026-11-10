/**
 * Gaveta Registrar (equipe, celular): o botão central da barra inferior.
 * Um lugar só para o que se lança da obra: foto, data real de etapa,
 * relatório da semana e pendência. Cada item leva ao fluxo que já existe.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  Camera,
  Check,
  ChevronRight,
  FileText,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useCan } from "@/hooks/useCan";
import { matchesSearch } from "@/lib/searchNormalize";
import { useReportPhotoInbox } from "@/hooks/useReportPhotoInbox";
import { useRelatorioSemanaStatus } from "@/hooks/useRelatorioSemanaStatus";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";
import { cn } from "@/lib/utils";

const L = equipeMobileLabels.registrar;

interface RegistrarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Obra da URL ou a última visitada. Sem ela, a gaveta abre pedindo a obra. */
  projectId?: string;
}

const rowClass = cn(
  // `!`: o CSS base fixa min-height de 44px em <button> e ganha do utilitário.
  "flex !min-h-[68px] w-full items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-2 text-left",
  "transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

function RowBody({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

export function RegistrarSheet({ open, onOpenChange, projectId }: RegistrarSheetProps) {
  const navigate = useNavigate();
  const photoInputId = useId();
  const { can } = useCan();
  const { data: projects = [] } = useProjectsQuery();
  const [selectedId, setSelectedId] = useState<string | undefined>(projectId);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  // Ao abrir, parte sempre da obra em que a pessoa está.
  useEffect(() => {
    if (!open) return;
    setSelectedId(projectId);
    setPicking(false);
    setQuery("");
  }, [open, projectId]);

  const selected = projects.find((p) => p.id === selectedId);
  const choosing = picking || !selected;

  const options = useMemo(() => {
    const active = projects.filter((p) => !p.status || p.status === "active" || p.status === "paused");
    const base = active.length > 0 ? active : projects;
    return query.trim()
      ? base.filter((p) => matchesSearch(query, [p.name, p.unit_name, p.customer_name]))
      : base;
  }, [projects, query]);

  const displayName = (p: { name: string; unit_name?: string | null }) =>
    `${p.name}${p.unit_name ? ` · ${p.unit_name}` : ""}`;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  // Só consulta com a gaveta aberta e uma obra escolhida.
  const activeId = open && selected ? selected.id : undefined;
  const { waiting, keep } = useReportPhotoInbox(activeId);
  const relatorio = useRelatorioSemanaStatus(activeId, {
    inicio: selected?.planned_start_date,
    fim: selected?.planned_end_date,
  });

  const onPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected || files.length === 0) return;
    // A foto fica guardada no aparelho; o relatório a recebe ao abrir.
    if (await keep(selected.id, files)) go(`/obra/${selected.id}/relatorio-semana`);
  };

  const canReport = can("reports:edit_weekly");
  const canSchedule = can("schedule:edit");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-0 rounded-t-3xl p-0 pb-safe">
        <SheetHeader className="shrink-0 px-5 pb-3 pt-5 text-left">
          <SheetTitle className="text-lg font-bold">{L.title}</SheetTitle>
          <SheetDescription>{choosing ? L.escolherObra : L.subtitle}</SheetDescription>
        </SheetHeader>

        {choosing ? (
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
            <div className="relative shrink-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={L.buscarObra}
                aria-label={L.buscarObra}
                className="min-h-[44px] pl-9 text-base"
              />
            </div>
            <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {options.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">{L.nenhumaObra}</li>
              )}
              {options.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setPicking(false);
                      setQuery("");
                    }}
                    className="flex !min-h-[52px] w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-foreground">{displayName(p)}</span>
                      {p.customer_name && (
                        <span className="block truncate text-sm text-muted-foreground">{p.customer_name}</span>
                      )}
                    </span>
                    {p.id === selectedId && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
            <div className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-muted/60 px-4 py-1.5">
              <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{L.obra}</span>
                <span className="line-clamp-2 break-words text-base font-semibold leading-snug text-foreground">{displayName(selected)}</span>
              </span>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {L.trocar}
              </button>
            </div>

            {canReport && (
              <>
                <input
                  id={photoInputId}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={onPhoto}
                />
                <label htmlFor={photoInputId} className={cn(rowClass, "cursor-pointer focus-within:ring-2 focus-within:ring-ring")}>
                  <RowBody
                    icon={Camera}
                    title={L.foto.title}
                    hint={waiting > 0 ? equipeMobileLabels.fotosGuardadas.esperando(waiting) : L.foto.hint}
                  />
                </label>
              </>
            )}
            {canSchedule && (
              <button type="button" className={rowClass} onClick={() => go(`/obra/${selected.id}/etapas`)}>
                <RowBody icon={CalendarCheck} title={L.etapa.title} hint={L.etapa.hint} />
              </button>
            )}
            {canReport && (
              <button type="button" className={rowClass} onClick={() => go(`/obra/${selected.id}/relatorio-semana`)}>
                <RowBody icon={FileText} title={L.relatorio.title} hint={relatorio.text} />
              </button>
            )}
            {can("ncs:create") && (
              <button
                type="button"
                className={rowClass}
                onClick={() => go(`/obra/${selected.id}/nao-conformidades?nova=1`)}
              >
                <RowBody icon={AlertCircle} title={L.pendencia.title} hint={L.pendencia.hint} />
              </button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
