/**
 * O que fazer — tela inicial da gestão.
 *
 * Abre o portal respondendo uma pergunta: "o que eu preciso resolver hoje?".
 * Junta as pendências de todas as obras da pessoa (em execução e em projeto),
 * da mais grave para a mais leve, cada uma com o botão que leva aonde ela se
 * resolve. No topo, o atalho para o Hoje com o que falta confirmar no dia.
 *
 * Regras em `@/lib/oQueFazer` e `@/lib/proximoPasso`. Interna (StaffRoute).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, CheckCircle2, ListChecks } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useObrasPainel } from "@/hooks/useObrasPainel";
import { useOpsDay } from "@/hooks/useOps";
import { useEtapasHoje } from "@/hooks/useEtapasHoje";
import { countDay, longDayLabel, todayISO } from "@/lib/hojeDia";
import { planningMonday, weekRange } from "@/lib/semanaPlan";
import { montarOQueFazer, type Tarefa } from "@/lib/oQueFazer";
import type { PassoTom } from "@/lib/proximoPasso";

const ESCOPO_KEY = "bwild.oQueFazer.escopo";
type Escopo = "minhas" | "todas";

const GRUPOS: { tom: PassoTom; titulo: string; dot: string }[] = [
  { tom: "vermelho", titulo: "Urgente", dot: "bg-destructive" },
  { tom: "amarelo", titulo: "Precisa de atenção", dot: "bg-warning" },
  { tom: "neutro", titulo: "Quando der", dot: "bg-muted-foreground/40" },
];

/** Quantas tarefas por grupo antes do "ver todas". */
const POR_GRUPO = 8;

function lerEscopo(): Escopo | null {
  try {
    const v = window.localStorage.getItem(ESCOPO_KEY);
    return v === "minhas" || v === "todas" ? v : null;
  } catch {
    return null;
  }
}

function TarefaLinha({ t }: { t: Tarefa }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-foreground">{t.texto}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.obraNome}
          {t.fase === "projeto" && " · em projeto"}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="min-h-[40px] shrink-0 self-start sm:self-auto">
        <Link to={t.href}>
          {t.acao}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

function Grupo({ titulo, dot, tarefas }: { titulo: string; dot: string; tarefas: Tarefa[] }) {
  const [todas, setTodas] = useState(false);
  if (tarefas.length === 0) return null;
  const shown = todas ? tarefas : tarefas.slice(0, POR_GRUPO);
  const rest = tarefas.length - shown.length;
  const id = `grupo-${titulo.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card px-4">
      <h2 id={id} className="flex items-center gap-2 border-b border-border py-3 text-sm font-semibold text-foreground">
        <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", dot)} />
        {titulo}
        <span className="font-normal tabular-nums text-muted-foreground">{tarefas.length}</span>
      </h2>
      <ul className="divide-y divide-border">
        {shown.map((t) => (
          <TarefaLinha key={t.key} t={t} />
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="mb-3 min-h-[40px] rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ver mais {rest}
        </button>
      )}
    </section>
  );
}

/** Atalho para o Hoje: o que falta confirmar no dia. */
function HojeCard({ today }: { today: string }) {
  const { data: itens } = useOpsDay(today);
  const { groups } = useEtapasHoje(today);
  const servicos = itens ? countDay(itens).pending : 0;
  const etapas = groups.reduce((s, g) => s + g.etapas.length, 0);
  if (servicos === 0 && etapas === 0) return null;
  const partes = [
    servicos > 0 && `${servicos} ${servicos === 1 ? "serviço para confirmar" : "serviços para confirmar"}`,
    etapas > 0 && `${etapas} ${etapas === 1 ? "etapa para dizer se começou ou terminou" : "etapas para dizer se começaram ou terminaram"}`,
  ].filter(Boolean);
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <CalendarCheck className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden="true" />
      <p className="flex-1 text-sm text-foreground">
        <span className="font-semibold">No Hoje: </span>
        {partes.join(" · ")}
      </p>
      <Button asChild className="min-h-[44px] shrink-0">
        <Link to="/gestao/hoje">
          Abrir o Hoje
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}

export default function OQueFazer() {
  const { user } = useAuth();
  const today = todayISO();
  const monday = planningMonday();
  const week = useMemo(() => weekRange(monday), [monday]);
  const { rows, projetos, isLoading, error, refetch } = useObrasPainel(week);

  const [escolha, setEscolha] = useState<Escopo | null>(lerEscopo);
  useEffect(() => {
    if (!escolha) return;
    try {
      window.localStorage.setItem(ESCOPO_KEY, escolha);
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }, [escolha]);

  const lista = useMemo(
    () => montarOQueFazer({ rows, projetos, userId: user?.id ?? null, monday, escopo: escolha }),
    [rows, projetos, user?.id, monday, escolha],
  );
  const total = lista.tarefas.length;

  const resumo = isLoading
    ? "Carregando…"
    : total === 0
      ? lista.escopo === "minhas"
        ? "Nada pendente nas suas obras."
        : "Nada pendente nas obras."
      : `${total} ${total === 1 ? "coisa" : "coisas"} para resolver em ${lista.obrasComPendencia} ${
          lista.obrasComPendencia === 1 ? "obra" : "obras"
        }.`;

  return (
    <PageContainer>
      <PageHeader eyebrow={longDayLabel(today)} title="O que fazer" description={resumo} />

      <HojeCard today={today} />

      <div className="mt-5 inline-flex rounded-lg border border-border bg-card p-0.5" role="radiogroup" aria-label="Quais obras">
        {(["minhas", "todas"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={lista.escopo === v}
            onClick={() => setEscolha(v)}
            className={cn(
              "min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              lista.escopo === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "minhas" ? "Minhas obras" : "Todas as obras"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4 pb-24">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={ListChecks}
            title="Não deu para carregar as obras"
            description={error}
            action={{ label: "Tentar de novo", onClick: refetch }}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tudo em dia"
            description={
              lista.escopo === "minhas"
                ? "Nenhuma pendência nas obras em que você é responsável."
                : "Nenhuma pendência nas obras."
            }
            action={lista.escopo === "minhas" ? { label: "Ver todas as obras", onClick: () => setEscolha("todas") } : undefined}
          />
        ) : (
          GRUPOS.map((g) => (
            <Grupo key={g.tom} titulo={g.titulo} dot={g.dot} tarefas={lista.tarefas.filter((t) => t.tom === g.tom)} />
          ))
        )}

        {!isLoading && !error && lista.emDia.length > 0 && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>
              Em dia, sem pendência: {lista.emDia.map((o) => o.nome).join(", ")}.
            </span>
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          <Link to="/gestao/painel-obras" className="underline underline-offset-2 hover:text-foreground">
            Ver o painel de obras
          </Link>
        </p>
      </div>
    </PageContainer>
  );
}
