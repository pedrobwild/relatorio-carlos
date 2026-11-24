/**
 * Conciliação Compras ↔ Workflow.
 *
 * Cada obra que aparece no Bwild Compras precisa de alguém dizendo qual obra
 * do Workflow ela é. Uma por vez, com confirmação — o sistema não sugere nem
 * escolhe por semelhança de nome. Só equipe interna; o cliente não vê nada.
 */
import { useMemo, useState } from "react";
import { Check, Link2, RefreshCw, Search, Undo2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState, PageHeader } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanFeature } from "@/hooks/useCan";
import {
  useAtualizarCompras,
  useComprasUltimaExecucao,
  useComprasVinculos,
  useDecidirVinculo,
  useObrasWorkflowParaVinculo,
} from "@/hooks/useComprasSync";
import type {
  ComprasObraVinculo,
  ComprasVinculoStatus,
} from "@/infra/repositories/comprasSync.repository";
import {
  buscarObras,
  contarPorStatus,
  copiaAtrasada,
  haQuanto,
  nomeDaObraNoCompras,
  nomeDaObraNoWorkflow,
  obrasJaVinculadas,
} from "@/lib/comprasVinculo";
import { cn } from "@/lib/utils";

const ABAS: { id: ComprasVinculoStatus; label: string }[] = [
  { id: "pendente", label: "A vincular" },
  { id: "confirmado", label: "Vinculadas" },
  { id: "ignorado", label: "Ignoradas" },
];

function EscolherObraSheet(props: {
  vinculo: ComprasObraVinculo | null;
  vinculos: ComprasObraVinculo[];
  onClose: () => void;
}) {
  const { vinculo, vinculos, onClose } = props;
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const obras = useObrasWorkflowParaVinculo(!!vinculo);
  const decidir = useDecidirVinculo();

  const lista = useMemo(() => buscarObras(obras.data ?? [], busca), [obras.data, busca]);
  const ocupadas = useMemo(() => obrasJaVinculadas(vinculos, vinculo?.id), [vinculos, vinculo?.id]);
  const obraEscolhida = (obras.data ?? []).find((o) => o.id === escolhida) ?? null;

  const fechar = () => {
    setBusca("");
    setEscolhida(null);
    onClose();
  };

  return (
    <Sheet open={!!vinculo} onOpenChange={(aberto) => !aberto && fechar()}>
      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-3 rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Qual obra do Workflow é esta?</SheetTitle>
          <SheetDescription>
            No Compras: <strong className="text-foreground">{vinculo ? nomeDaObraNoCompras(vinculo) : ""}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar obra, unidade ou cliente"
            aria-label="Buscar obra do Workflow"
            className="h-12 pl-9 text-base"
          />
        </div>

        <ul className="-mx-1 flex-1 space-y-1.5 overflow-y-auto px-1" aria-label="Obras do Workflow">
          {obras.isLoading && <Skeleton className="h-14 w-full rounded-xl" />}
          {!obras.isLoading && lista.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma obra encontrada.</li>
          )}
          {lista.map((o) => {
            const marcada = escolhida === o.id;
            const outra = ocupadas.get(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setEscolhida(o.id)}
                  aria-pressed={marcada}
                  className={cn(
                    "flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    marcada ? "border-primary bg-primary/10" : "border-border bg-card",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{o.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[o.unit_name ? `Unid. ${o.unit_name}` : null, o.customer_name].filter(Boolean).join(" · ") || "Sem cliente"}
                    </span>
                    {outra && (
                      <span className="mt-0.5 block text-xs text-warning">Já vinculada a: {outra}</span>
                    )}
                  </span>
                  {marcada && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="space-y-2 border-t border-border pt-3">
          {obraEscolhida && (
            <p className="text-xs text-muted-foreground">
              Vai vincular a: <strong className="text-foreground">{nomeDaObraNoWorkflow(obraEscolhida)}</strong>
            </p>
          )}
          <Button
            className="h-12 w-full text-base"
            disabled={!vinculo || !escolhida || decidir.isPending}
            onClick={() => {
              if (!vinculo || !escolhida) return;
              decidir.mutate(
                { vinculoId: vinculo.id, acao: "confirmar", projectId: escolhida },
                { onSuccess: fechar },
              );
            }}
          >
            Confirmar vínculo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ComprasConciliacao() {
  const podeConciliar = useCanFeature("compras:conciliar");
  const vinculos = useComprasVinculos();
  const ultima = useComprasUltimaExecucao();
  const atualizar = useAtualizarCompras();
  const decidir = useDecidirVinculo();
  const [aba, setAba] = useState<ComprasVinculoStatus>("pendente");
  const [aberto, setAberto] = useState<ComprasObraVinculo | null>(null);

  const todos = useMemo(() => vinculos.data ?? [], [vinculos.data]);
  const total = useMemo(() => contarPorStatus(todos), [todos]);
  const lista = todos.filter((v) => v.status === aba);
  const exec = ultima.data ?? null;
  const falhou = exec?.ok === false;
  const velha = copiaAtrasada(exec?.terminado_em ?? exec?.iniciado_em);

  return (
    <PageContainer>
      <PageHeader
        title="Obras do Compras"
        description="Diga de qual obra do Workflow é cada obra do Bwild Compras. Uma por vez."
        actions={
          <Button
            variant="outline"
            className="h-11"
            onClick={() => atualizar.mutate()}
            disabled={atualizar.isPending}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", atualizar.isPending && "animate-spin")} aria-hidden />
            Atualizar agora
          </Button>
        }
      />

      <p
        className={cn(
          "mb-4 rounded-xl border px-3.5 py-2.5 text-sm",
          falhou
            ? "border-destructive/50 bg-destructive/10 text-foreground"
            : velha
              ? "border-warning/50 bg-warning/10 text-foreground"
              : "border-border bg-muted/40 text-muted-foreground",
        )}
        role="status"
      >
        {!exec
          ? "Ainda não houve nenhuma atualização do Compras."
          : falhou
            ? `A última atualização falhou (${haQuanto(exec.iniciado_em)}). Os dados abaixo são da última que deu certo.`
            : `Atualizado ${haQuanto(exec.terminado_em ?? exec.iniciado_em)}.${velha ? " Está atrasado: o normal é a cada 5 minutos." : ""}`}
      </p>

      <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Situação do vínculo">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "min-h-[48px] rounded-xl border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              aba === a.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground",
            )}
          >
            {a.label} <span className="tabular-nums opacity-80">({total[a.id]})</span>
          </button>
        ))}
      </div>

      {vinculos.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={aba === "pendente" ? "Nada a vincular" : "Nenhuma obra aqui"}
          description={
            aba === "pendente"
              ? "Toda obra que apareceu no Compras já foi vinculada ou ignorada."
              : "As obras aparecem aqui conforme você decide."
          }
        />
      ) : (
        <ul className="space-y-2" aria-label="Obras do Compras">
          {lista.map((v) => (
            <li key={v.id} className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-sm font-semibold text-foreground">{v.cliente}</p>
              <p className="text-xs text-muted-foreground">
                {[v.empreendimento, v.unidade ? `Unid. ${v.unidade}` : null].filter(Boolean).join(" · ") ||
                  "Sem empreendimento"}
                {" · "}
                {v.solicitacoes} {v.solicitacoes === 1 ? "solicitação" : "solicitações"}
              </p>

              {v.status === "confirmado" && (
                <p className="mt-2 text-sm text-foreground">
                  <span className="text-muted-foreground">No Workflow: </span>
                  <strong>{v.project?.name ?? "Obra"}</strong>
                  {v.decidido_por_nome && (
                    <span className="block text-xs text-muted-foreground">Por {v.decidido_por_nome}</span>
                  )}
                </p>
              )}

              {podeConciliar && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {v.status !== "confirmado" && (
                    <Button className="h-11 flex-1" onClick={() => setAberto(v)}>
                      <Link2 className="mr-2 h-4 w-4" aria-hidden />
                      Vincular obra
                    </Button>
                  )}
                  {v.status === "pendente" && (
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ vinculoId: v.id, acao: "ignorar" })}
                    >
                      Não é obra
                    </Button>
                  )}
                  {v.status === "confirmado" && (
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ vinculoId: v.id, acao: "desfazer" })}
                    >
                      <Undo2 className="mr-2 h-4 w-4" aria-hidden />
                      Desfazer vínculo
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!podeConciliar && !vinculos.isLoading && (
        <p className="mt-4 text-xs text-muted-foreground">
          Só gestão, suprimentos e administração vinculam obras. Você pode consultar.
        </p>
      )}

      <EscolherObraSheet vinculo={aberto} vinculos={todos} onClose={() => setAberto(null)} />
    </PageContainer>
  );
}
