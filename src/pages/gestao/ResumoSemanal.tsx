/**
 * Resumo da semana — leitura da diretoria, pensada para o celular.
 *
 * Do resumo para o detalhe: os números grandes, as obras que precisam de
 * atenção (cada uma abre a gaveta da obra no Painel), a adoção do
 * planejamento semanal por gestor e os motivos do não feito. "Copiar resumo"
 * gera um texto curto para colar no WhatsApp.
 *
 * As contas ficam em `lib/resumoSemanal.ts` e reaproveitam as do Painel.
 * Acesso: `portfolio:resumo` (admin e manager).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, ClipboardCopy, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/useCan";
import { useIsMobile } from "@/hooks/use-mobile";
import { useResumoSemanal } from "@/hooks/useResumoSemanal";
import { copyText } from "@/lib/clipboard";
import { ddmm, formatBRL, RISK_LABEL, slackLabel } from "@/lib/obrasPainel";
import {
  ADOCAO_SEMANAS,
  mondayShortLabel,
  resumoWhatsApp,
  weekShortLabel,
  type AdocaoGestor,
  type AdocaoSemana,
  type AtencaoItem,
  type ResumoSemanal as Resumo,
} from "@/lib/resumoSemanal";
import { RISK_DOT } from "@/components/gestao/obras/ObrasList";

/** Endereço da obra no Painel (abre a gaveta dela). */
const obraHref = (id: string) => `/gestao/obras?obra=${encodeURIComponent(id)}`;

type Tone = "destructive" | "warning" | "success" | "muted";

const TEXT_TONE: Record<Tone, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted-foreground",
};

const CHIP_TONE: Record<Tone, string> = {
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted text-muted-foreground",
};

/** Cor da taxa de adoção: < 50% vermelho, < 80% amarelo, senão verde. */
function rateTone(rate: number | null): Tone {
  if (rate == null) return "muted";
  if (rate < 50) return "destructive";
  if (rate < 80) return "warning";
  return "success";
}

/** Cor de uma semana do gestor: todas fechadas, algumas, nenhuma. */
function weekTone(w: AdocaoSemana, n: number): Tone {
  if (n === 0) return "muted";
  if (w.closed >= n) return "success";
  if (w.closed > 0) return "warning";
  return "destructive";
}

const WEEK_CELL: Record<Tone, string> = {
  destructive: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  muted: "bg-muted-foreground/30",
};

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function BigNumber({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-2xl font-semibold leading-tight tabular-nums",
          tone === "muted" ? "text-foreground" : TEXT_TONE[tone],
        )}
      >
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `resumo-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="mt-6" aria-labelledby={id}>
      <h2 id={id} className="text-base font-semibold text-foreground">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RiskChip({ risk }: { risk: AtencaoItem["risk"] }) {
  const tone: Tone = risk === "vermelho" ? "destructive" : risk === "amarelo" ? "warning" : risk === "verde" ? "success" : "muted";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", CHIP_TONE[tone])}>
      <span className={cn("h-2 w-2 rounded-full", RISK_DOT[risk])} aria-hidden="true" />
      {RISK_LABEL[risk]}
    </span>
  );
}

function RateChip({ rate, label }: { rate: number | null; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        CHIP_TONE[rateTone(rate)],
      )}
    >
      {rate == null ? "—" : `${rate}%`}
      {label && <span className="ml-1 font-medium">{label}</span>}
    </span>
  );
}

/** As 4 semanas do gestor como quadradinhos (forma) e "f/n" (número). */
function WeekStrip({ g, compact = false }: { g: AdocaoGestor; compact?: boolean }) {
  return (
    <ol className={cn("flex gap-1.5", compact ? "" : "flex-wrap")} aria-label="Semanas fechadas">
      {g.weeks.map((w) => {
        const tone = weekTone(w, g.n);
        return (
          <li
            key={w.monday}
            className="flex min-w-[52px] flex-col items-center rounded-md border border-border bg-background px-1.5 py-1"
            title={`Semana de ${weekShortLabel(w.monday)}: ${w.planned}/${g.n} planejadas, ${w.closed}/${g.n} fechadas`}
          >
            <span className="text-[11px] text-muted-foreground">{mondayShortLabel(w.monday)}</span>
            <span className={cn("mt-0.5 h-1.5 w-full rounded-full", WEEK_CELL[tone])} aria-hidden="true" />
            <span className="mt-0.5 text-xs tabular-nums text-foreground">
              <span className="sr-only">fechadas </span>
              {w.closed}/{g.n}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              <span className="sr-only">planejadas </span>P {w.planned}/{g.n}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AtencaoList({ items }: { items: AtencaoItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Nenhuma obra no vermelho ou em atenção.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            to={obraHref(a.id)}
            className="flex min-h-[56px] items-start gap-3 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{a.name}</span>
                <RiskChip risk={a.risk} />
              </span>
              <span className={cn("mt-0.5 block text-sm", a.risk === "vermelho" ? "text-destructive" : "text-warning")}>
                {a.reason}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {[a.responsible ?? "Sem responsável", a.slack != null ? `folga ${slackLabel(a.slack)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function AdocaoCards({ rows }: { rows: AdocaoGestor[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((g) => (
        <li key={g.responsibleId ?? "__sem__"} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{g.name}</p>
              <p className="text-xs text-muted-foreground">
                {g.obras} {g.obras === 1 ? "obra em execução" : "obras em execução"}
                {g.obras > g.n ? ` · ${g.obras - g.n} paralisada${g.obras - g.n === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            <RateChip rate={g.closedRate} label="fechadas" />
          </div>
          <div className="mt-2 overflow-x-auto">
            <WeekStrip g={g} compact />
          </div>
          <p className="mt-2 text-sm text-foreground">
            Esta semana: <span className="font-medium tabular-nums">{g.plannedThisWeek}/{g.n}</span> planejadas
            {" · "}PPC <span className="font-medium tabular-nums">{g.lastPpc == null ? "—" : `${g.lastPpc}%`}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function AdocaoTable({ rows }: { rows: AdocaoGestor[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Gestor</th>
            <th scope="col" className="px-3 py-2 font-medium">Obras</th>
            <th scope="col" className="px-3 py-2 font-medium">Semanas (fechadas · P = planejadas)</th>
            <th scope="col" className="px-3 py-2 font-medium">{ADOCAO_SEMANAS} semanas</th>
            <th scope="col" className="px-3 py-2 font-medium">Esta semana</th>
            <th scope="col" className="px-3 py-2 font-medium">PPC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((g) => (
            <tr key={g.responsibleId ?? "__sem__"}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">{g.name}</th>
              <td className="px-3 py-2 tabular-nums text-foreground">
                {g.n}
                {g.obras > g.n && <span className="text-xs text-muted-foreground"> +{g.obras - g.n} paralisada{g.obras - g.n === 1 ? "" : "s"}</span>}
              </td>
              <td className="px-3 py-2">
                <WeekStrip g={g} />
              </td>
              <td className="px-3 py-2">
                <RateChip rate={g.closedRate} />
                <span className="ml-1 text-xs text-muted-foreground">
                  planejou {g.plannedRate == null ? "—" : `${g.plannedRate}%`}
                </span>
              </td>
              <td className="px-3 py-2 tabular-nums text-foreground">{g.plannedThisWeek}/{g.n} planejadas</td>
              <td className="px-3 py-2 tabular-nums text-foreground">{g.lastPpc == null ? "—" : `${g.lastPpc}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Motivos({ resumo }: { resumo: Resumo }) {
  const reasons = resumo.semana.reasons;
  if (reasons.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {resumo.semana.closed === 0
          ? "Nenhuma obra fechou a semana: ainda não há motivos registrados."
          : "Nenhum dia não feito nas semanas fechadas."}
      </p>
    );
  }
  const max = reasons[0].count;
  return (
    <ul className="space-y-2 rounded-xl border border-border bg-card p-3">
      {reasons.map((r) => (
        <li key={r.reason}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-foreground">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.count} {r.count === 1 ? "dia" : "dias"}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-warning" style={{ width: `${Math.max(6, (100 * r.count) / max)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function ResumoConteudo() {
  const isMobile = useIsMobile();
  const { resumo, isLoading, error, historyError, refetch } = useResumoSemanal();
  const s = resumo.semana;
  const c = resumo.carteira;

  const copiar = async () => {
    const ok = await copyText(resumoWhatsApp(resumo));
    if (ok) toast.success("Resumo copiado. É só colar no WhatsApp.");
    else toast.error("Não deu para copiar. Tente de novo ou selecione o texto à mão.");
  };

  const ready = !isLoading && !error;

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        eyebrow="Diretoria"
        title="Resumo da semana"
        description={`Semana que passou: ${weekShortLabel(s.monday)}`}
        actions={
          <Button type="button" onClick={copiar} disabled={!ready} className="min-h-[44px]" aria-label="Copiar resumo para o WhatsApp">
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            Copiar resumo
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-5 space-y-3" aria-busy="true" aria-label="Carregando resumo">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={Building2}
          title="Não deu para carregar o resumo"
          description={error}
          action={{ label: "Tentar de novo", onClick: refetch }}
        />
      ) : c.active === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma obra em execução"
          description="Quando uma obra começa, ela entra no resumo com prazo, risco e o planejamento da semana."
        />
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Números da semana">
            <BigNumber
              label="PPC da semana"
              value={historyError ? "–" : s.ppc == null ? "—" : `${s.ppc}%`}
              hint={historyError ? undefined : s.planned > 0 ? `${s.done} de ${s.planned} dias feitos` : "nenhuma obra fechou"}
            />
            <BigNumber
              label="Fecharam a semana"
              value={historyError ? "–" : `${s.closed}/${s.withPlan}`}
              hint={historyError ? undefined : s.withoutPlan > 0 ? `${s.withoutPlan} sem planejamento` : "das obras planejadas"}
              tone={historyError ? "muted" : s.withPlan > 0 && s.closed < s.withPlan ? "warning" : "muted"}
            />
            <BigNumber label="No vermelho" value={String(c.red)} hint={`de ${c.active} em execução`} tone={c.red > 0 ? "destructive" : "muted"} />
            <BigNumber
              label="Em atenção"
              value={String(c.yellow)}
              hint={c.noDeadline > 0 ? `${c.noDeadline} sem prazo cadastrado` : undefined}
              tone={c.yellow > 0 ? "warning" : "muted"}
            />
            <BigNumber
              label="Multa projetada"
              value={formatBRL(c.penaltyTotal)}
              hint={c.penaltyUnknown > 0 ? `+${c.penaltyUnknown} atrasada${c.penaltyUnknown === 1 ? "" : "s"} sem multa no contrato` : undefined}
              tone={c.penaltyTotal > 0 ? "destructive" : "muted"}
            />
            <BigNumber
              label="Entregas em 2 semanas"
              value={String(c.deliveries.length)}
              hint={
                c.deliveries.length > 0
                  ? c.deliveries.map((d) => `${d.name} (${ddmm(d.deadline)})`).join(", ")
                  : undefined
              }
            />
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">
            {c.active} {c.active === 1 ? "obra em execução" : "obras em execução"}
            {c.paused > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {c.paused} {c.paused === 1 ? "paralisada" : "paralisadas"}
                </span>
              </>
            )}
          </p>

          <Section title="Precisa de atenção" description="Até 5 obras, da mais grave para a menos. Toque para abrir no Painel.">
            <AtencaoList items={resumo.atencao} />
          </Section>

          <Section
            title="Adoção por gestor"
            description={`Nas últimas ${ADOCAO_SEMANAS} semanas terminadas: quantas obras cada gestor planejou e fechou. Quem usa menos aparece primeiro.`}
          >
            {historyError ? (
              <EmptyState
                icon={Building2}
                title="Não deu para carregar o planejamento semanal"
                description={historyError}
                action={{ label: "Tentar de novo", onClick: refetch }}
              />
            ) : isMobile ? (
              <AdocaoCards rows={resumo.adocao} />
            ) : (
              <AdocaoTable rows={resumo.adocao} />
            )}
          </Section>

          {!historyError && (
            <Section title="Por que não foi feito" description={`Motivos somados das obras que fecharam a semana de ${weekShortLabel(s.monday)}.`}>
              <Motivos resumo={resumo} />
            </Section>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Semana que passou = segunda a domingo já terminados. PPC = dias feitos ÷ dias marcados, só nas obras que
            fecharam a semana. Obra planejada = ao menos um dia marcado na semana; fechada = semana fechada na tela
            Semana. Obras paralisadas não contam para planejamento nem adoção. Risco, folga e multa são os mesmos do
            Painel de Obras.
          </p>
        </>
      )}
    </PageContainer>
  );
}

export default function ResumoSemanal() {
  const { can, loading } = useCan();
  if (loading) {
    return (
      <PageContainer maxWidth="full">
        <Skeleton className="mt-5 h-24 w-full rounded-xl" aria-label="Carregando" />
      </PageContainer>
    );
  }
  if (!can("portfolio:resumo")) {
    return (
      <PageContainer maxWidth="full">
        <EmptyState
          icon={Lock}
          title="Sem acesso ao resumo da semana"
          description="Este resumo é da diretoria. Se você precisa dele, peça acesso a um administrador."
        />
      </PageContainer>
    );
  }
  return <ResumoConteudo />;
}
