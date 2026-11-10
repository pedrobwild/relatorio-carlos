/**
 * Lista de obras da equipe no celular (redesenho mobile, passo 1).
 *
 * Busca, três filtros (Todas / Atenção / Minhas) e um cartão por obra com o
 * que importa em pé na obra: etapa atual, situação do prazo, progresso e
 * quantas etapas esperam data real. Tocar abre o hub da obra.
 *
 * Só apresentação: as linhas chegam prontas de `useObrasPainel` (as mesmas
 * do Painel de Obras), sem consulta nova.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronRight, Search } from "lucide-react";
import { EmptyState } from "@/components/ui-premium";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ObraRow } from "@/lib/obrasPainel";
import { searchObraRows } from "@/lib/painelNovo";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";

const L = equipeMobileLabels.obras;

type ObrasMobileFiltro = "todas" | "atencao" | "minhas";

const pedeAtencao = (r: ObraRow) => r.risk === "vermelho" || r.risk === "amarelo";

/** Etapas (nível mais detalhado) atrasadas ou que já deveriam ter começado. */
function etapasEsperando(r: ObraRow): number {
  return r.andamento?.agora.filter((i) => i.state === "atrasada" || i.state === "sem_inicio").length ?? 0;
}

function filtrarObrasMobile(rows: readonly ObraRow[], filtro: ObrasMobileFiltro, userId: string | undefined): ObraRow[] {
  if (filtro === "atencao") return rows.filter(pedeAtencao);
  if (filtro === "minhas") return rows.filter((r) => !!userId && r.responsibleId === userId);
  return [...rows];
}

function prazoChip(r: ObraRow): { text: string; tone: string } {
  if (r.cadastro?.paused) return { text: L.paralisada, tone: "bg-muted text-muted-foreground" };
  if (r.slack != null && r.slack < 0) return { text: L.diasDeAtraso(Math.abs(r.slack)), tone: "bg-destructive/10 text-destructive" };
  if (r.risk === "vermelho" || r.risk === "amarelo") return { text: L.atencao, tone: "bg-warning/15 text-warning" };
  if (r.risk === "sem_prazo") return { text: L.semPrazo, tone: "bg-muted text-muted-foreground" };
  return { text: L.noPrazo, tone: "bg-success/15 text-success" };
}

interface ObrasMobileListProps {
  rows: readonly ObraRow[];
  userId: string | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Links para o que não cabe nesta lista (outras listas, painel completo). */
  footer?: React.ReactNode;
}

export function ObrasMobileList({ rows, userId, isLoading, error, onRetry, footer }: ObrasMobileListProps) {
  const [filtro, setFiltro] = useState<ObrasMobileFiltro>("todas");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      todas: rows.length,
      atencao: filtrarObrasMobile(rows, "atencao", userId).length,
      minhas: filtrarObrasMobile(rows, "minhas", userId).length,
    }),
    [rows, userId],
  );
  const visible = useMemo(
    () => searchObraRows(filtrarObrasMobile(rows, filtro, userId), query),
    [rows, filtro, userId, query],
  );
  const noData = isLoading || !!error;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pb-6 pt-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{L.title}</h1>
        {!noData && <p className="mt-0.5 text-sm text-muted-foreground">{L.resumo(counts.todas, counts.atencao)}</p>}
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={L.buscar}
          aria-label={L.buscar}
          className="h-12 rounded-xl pl-10 text-base"
        />
      </div>

      <div role="radiogroup" aria-label={L.filtrosLabel} className="flex flex-wrap gap-2">
        {(["todas", "atencao", "minhas"] as const).map((f) => {
          const on = filtro === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFiltro(f)}
              className={cn(
                "flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-colors min-[360px]:px-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
              )}
            >
              {L.filtros[f]}
              {!noData && <span className={cn("tabular-nums", on ? "text-primary-foreground/90" : "text-muted-foreground")}>{counts[f]}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2.5" aria-busy="true" aria-label="Carregando obras">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={Building2} title={L.erro} description={error} action={{ label: L.tentarDeNovo, onClick: onRetry }} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title={L.vazio.title} description={L.vazio.description} />
      ) : visible.length === 0 && query.trim() ? (
        <EmptyState icon={Search} title={L.vazioBusca(query.trim())} action={{ label: L.limparBusca, onClick: () => setQuery("") }} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Building2} title={L.vazioFiltro.title} action={{ label: L.vazioFiltro.action, onClick: () => setFiltro("todas") }} />
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label={L.title}>
          {visible.map((r) => {
            const chip = prazoChip(r);
            const esperando = etapasEsperando(r);
            const etapa = r.andamento?.atual?.name ?? null;
            const sub = [r.customer, etapa].filter(Boolean).join(" · ");
            const pct = r.progress == null ? null : Math.max(0, Math.min(100, Math.round(r.progress)));
            const semCronograma = !r.andamento || r.andamento.fase === "sem_cronograma";
            return (
              <li key={r.id}>
                <Link
                  to={`/obra/${r.id}`}
                  className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="line-clamp-2 break-words text-base font-semibold leading-snug text-foreground">{r.name}</span>
                      {sub && <span className="block truncate text-sm text-muted-foreground">{sub}</span>}
                    </div>
                    <span className={cn("shrink-0 whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold", chip.tone)}>
                      {chip.text}
                    </span>
                  </div>
                  {pct != null && (
                    <div className="flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={L.progresso(pct)}
                        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        esperando > 0 ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {semCronograma ? L.semCronograma : esperando > 0 ? L.etapasParaAtualizar(esperando) : L.tudoEmDia}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {footer}
    </div>
  );
}
