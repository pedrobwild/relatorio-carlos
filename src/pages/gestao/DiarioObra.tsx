/**
 * Diário de obra — relatório de campo diário, feito no celular, em pé, na
 * obra. Rota de equipe: /gestao/diario.
 *
 * 5 passos: quem e onde → etapas do dia (com foto) → equipe → algo mais hoje?
 * (pendências, material, prazo: só o que houver) → conferir e enviar.
 *
 * O envio passa pela caixa de saída do aparelho (`diarioOutbox`): com sinal,
 * sobe na hora; sem sinal, fica guardado e sobe sozinho. No banco, as etapas
 * concluídas viram término real, os marcos definem o início real da obra e o
 * que é do cliente entra sozinho no relatório semanal do portal. As regras da
 * tela estão em `src/lib/diarioObra/regras.ts`.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DiarioEtapas } from "@/components/diario/DiarioEtapas";
import {
  PassoConferir,
  PassoEnviado,
  PassoEquipe,
  PassoIdentificacao,
  PassoMaterial,
  PassoPendencias,
  PassoPrazo,
  PassoTriagem,
} from "@/components/diario/DiarioPassos";
import { BotaoPrincipal, DiarioRelatorioCliente } from "@/components/diario/DiarioRelatorioCliente";
import { Cartao, LinkBotao, Nota, Opcao } from "@/components/diario/DiarioUi";
import { useAuth } from "@/hooks/useAuth";
import {
  useDiarioEquipe,
  useDiarioEtapas,
  useDiarioFila,
  useDiarioItensMaterial,
  useDiarioObras,
  useDiarioRelatos,
} from "@/hooks/useDiarioObra";
import { useIsOnline } from "@/hooks/useOpsOffline";
import type { DiarioRelatoRow } from "@/infra/repositories/diarioObra.repository";
import {
  avisoPendencia,
  botaoApagado,
  CABECALHOS,
  dataDoRelato,
  diarioReducer,
  errosComTela,
  estadoInicial,
  etapasTocadas,
  hojeISO,
  montarPayload,
  ordenarEtapas,
  rotuloBotao,
  SEGMENTO,
  semanaDoRelatorio,
  validar,
} from "@/lib/diarioObra/regras";
import type { FotoPendente } from "@/lib/offline/diarioOutbox";
import { getDiarioOutbox } from "@/lib/offline/diarioSync";
import { cn } from "@/lib/utils";
import { DiarioComentarSheet } from "@/components/diario/DiarioComentarSheet";

const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Cabeçalho, corpo com rolagem e botão principal sempre à mão. */
function Moldura(props: {
  kicker: string;
  titulo: string;
  onVoltar?: () => void;
  online: boolean;
  segmento: number;
  concluido?: boolean;
  rodape: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="flex flex-col gap-2.5 border-b border-border pb-3">
        <div className="flex min-h-[48px] items-center gap-2">
          {props.onVoltar && (
            <button
              type="button"
              aria-label="Voltar"
              onClick={props.onVoltar}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground">{props.kicker}</p>
            <h1 className="text-[21px] font-extrabold leading-tight text-foreground">{props.titulo}</h1>
          </div>
          <span
            role="status"
            className={cn(
              "flex min-h-[44px] max-w-[104px] items-center rounded-xl border-2 px-3 text-xs font-bold leading-tight",
              props.online ? "border-success bg-success/10 text-foreground" : "border-warning bg-warning/15 text-foreground",
            )}
          >
            {props.online ? "Online" : "Offline · salva no aparelho"}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= props.segmento ? (props.concluido ? "bg-success" : "bg-primary") : "bg-border",
              )}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-3.5 py-4">{props.children}</div>

      <footer className="sticky bottom-[var(--bottom-nav-offset,0px)] z-10 flex flex-col gap-2 border-t border-border bg-background pb-4 pt-3 lg:bottom-0">
        {props.rodape}
      </footer>
    </div>
  );
}

export default function DiarioObra() {
  const { user } = useAuth();
  const online = useIsOnline();
  const [state, dispatch] = useReducer(diarioReducer, undefined, estadoInicial);
  // Fotos tiradas neste relato: ficam fora do estado (são arquivos).
  const fotos = useRef(new Map<string, Blob>());
  const [relatoAberto, setRelatoAberto] = useState<DiarioRelatoRow | null>(null);
  const [relatoComentado, setRelatoComentado] = useState<DiarioRelatoRow | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroDeEnvio, setErroDeEnvio] = useState<string | null>(null);

  const hoje = useMemo(() => hojeISO(), []);
  const dia = dataDoRelato(state.dataEscolha, hoje);
  const relator =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "Você";

  const obrasQ = useDiarioObras();
  const obras = useMemo(() => obrasQ.data ?? [], [obrasQ.data]);
  const obra = obras.find((o) => o.id === state.obraId);

  // Vindo da gaveta Registrar, a obra já chega escolhida (?obra=<id>).
  const [params] = useSearchParams();
  const obraDaUrl = params.get("obra");
  const aplicouObraDaUrl = useRef(false);
  useEffect(() => {
    if (aplicouObraDaUrl.current || !obraDaUrl || obras.length === 0) return;
    aplicouObraDaUrl.current = true;
    if (obras.some((o) => o.id === obraDaUrl)) dispatch({ type: "obra", id: obraDaUrl });
  }, [obraDaUrl, obras]);

  const etapasQ = useDiarioEtapas(state.obraId);
  const relatos = useDiarioRelatos(state.obraId);
  const equipeQ = useDiarioEquipe(state.obraId);
  const itensQ = useDiarioItensMaterial(state.obraId, state.temMaterial);
  const fila = useDiarioFila(user?.id);

  // Em aberto, mais as que já têm relato (para o relatório do cliente).
  const etapas = useMemo(
    () => ordenarEtapas(etapasQ.etapas.filter((e) => !e.actualEnd || relatos.porEtapa.has(e.id)), dia),
    [etapasQ.etapas, relatos.porEtapa, dia],
  );

  const erros = useMemo(() => validar(state, etapas), [state, etapas]);
  const tela = state.tela;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tela, relatoAberto]);

  const guardarFoto = useCallback((blob: Blob) => {
    const id = novoId();
    fotos.current.set(id, blob);
    return id;
  }, []);

  const enviar = async () => {
    if (errosComTela(erros).length > 0 || !user || !obra) {
      dispatch({ type: "avancar", etapas });
      return;
    }
    const clientId = novoId();
    const payload = montarPayload({ state, etapas, clientId, hoje, offline: !online });
    const usadas = [
      ...payload.etapas.map((e) => ({ id: e.foto_id, kind: "etapa" as const })),
      ...payload.materiais.flatMap((m) => (m.foto_id ? [{ id: m.foto_id, kind: "divergencia" as const }] : [])),
    ];
    const pendentes: FotoPendente[] = [];
    for (const f of usadas) {
      const blob = fotos.current.get(f.id);
      if (!blob) {
        setErroDeEnvio("Uma foto se perdeu neste aparelho. Volte à etapa e tire a foto de novo.");
        return;
      }
      pendentes.push({ id: f.id, kind: f.kind, blob, type: blob.type || "image/jpeg" });
    }

    const inicio = [obra.actual_start_date, obra.planned_start_date].filter((d): d is string => !!d).sort()[0] ?? null;
    setEnviando(true);
    setErroDeEnvio(null);
    try {
      const outbox = getDiarioOutbox();
      const res = await outbox.enqueue({
        id: clientId,
        userId: user.id,
        projectId: obra.id,
        projectName: obra.name,
        weekNumber: semanaDoRelatorio(inicio, payload.report_date)?.weekNumber ?? 0,
        payload,
        fotos: pendentes,
        createdAt: Date.now(),
      });
      if (res.status === "recusado") {
        // A pessoa ainda está com o relato na tela: corrige e envia de novo.
        await outbox.discard(clientId);
        setErroDeEnvio(res.message);
        return;
      }
      dispatch({ type: "enviado", offline: res.status === "na_fila" });
    } catch (err) {
      console.error("[Diario] Falha ao guardar o relato no aparelho:", err);
      setErroDeEnvio("Não deu para guardar o relato neste aparelho. Libere espaço e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const novoRelato = () => {
    fotos.current.clear();
    setErroDeEnvio(null);
    dispatch({ type: "novoRelato" });
  };

  // ----- Relatório do cliente de uma etapa já relatada -----
  if (relatoAberto) {
    return (
      <DiarioRelatorioCliente
        key={relatoAberto.id}
        relato={relatoAberto}
        obra={obra}
        etapas={etapasQ.etapas}
        onVoltar={() => setRelatoAberto(null)}
      >
        {({ corpo, rodape }) => (
          <Moldura
            kicker="Portal do cliente"
            titulo="Relatório da etapa"
            onVoltar={() => setRelatoAberto(null)}
            online={online}
            segmento={1}
            rodape={rodape}
          >
            {corpo}
          </Moldura>
        )}
      </DiarioRelatorioCliente>
    );
  }

  const aviso = avisoPendencia(state);
  const [kicker, titulo] = CABECALHOS[tela];

  const rodape =
    tela === "ok" ? (
      <>
        <BotaoPrincipal onClick={novoRelato}>Relatar outra obra</BotaoPrincipal>
        <Nota className="text-center">Você e a data ficam salvos. Escolha só a obra.</Nota>
      </>
    ) : tela === "conf" ? (
      <BotaoPrincipal onClick={() => void enviar()} disabled={enviando} apagado={botaoApagado(state, erros)}>
        {enviando ? "Enviando…" : rotuloBotao(state, online)}
      </BotaoPrincipal>
    ) : (
      <BotaoPrincipal onClick={() => dispatch({ type: "avancar", etapas })} apagado={botaoApagado(state, erros)}>
        {rotuloBotao(state, online)}
      </BotaoPrincipal>
    );

  return (
    <>
      <Moldura
        kicker={kicker}
        titulo={titulo}
        onVoltar={tela !== "id" && tela !== "ok" ? () => dispatch({ type: "voltar" }) : undefined}
        online={online}
        segmento={SEGMENTO[tela]}
        concluido={tela === "ok"}
        rodape={rodape}
      >
        {tela === "id" && (
          <>
            {fila.aguardando.length > 0 && (
              <Cartao className="border-warning bg-warning/10">
                <p className="text-base font-bold text-foreground">
                  {fila.aguardando.length} relato(s) guardado(s) neste aparelho, aguardando sinal.
                </p>
                <Nota>Sobem sozinhos quando a conexão voltar.</Nota>
              </Cartao>
            )}
            {fila.recusados.map((item) => (
              <Cartao key={item.id} erro>
                <p className="text-base font-bold text-foreground">O relato de {item.projectName} não foi aceito.</p>
                <Nota>{item.error}</Nota>
                <div className="flex gap-2">
                  <LinkBotao
                    onClick={() =>
                      void getDiarioOutbox()
                        .retry(item.id)
                        .then((r) => r.status === "enviado" && toast.success("Relato enviado."))
                    }
                  >
                    Tentar de novo
                  </LinkBotao>
                  <LinkBotao onClick={() => void getDiarioOutbox().discard(item.id)}>Descartar</LinkBotao>
                </div>
              </Cartao>
            ))}
            <PassoIdentificacao
              state={state}
              dispatch={dispatch}
              hoje={hoje}
              obras={obras}
              carregando={obrasQ.isLoading}
              falhou={obrasQ.isError}
              relator={relator}
            />
          </>
        )}

        {tela === "etapas" && (
          <DiarioEtapas
            state={state}
            dispatch={dispatch}
            etapas={etapas}
            dia={dia}
            hoje={hoje}
            erros={erros.etapas}
            relatos={relatos.porEtapa}
            carregando={etapasQ.isLoading}
            falhou={etapasQ.isError}
            onFoto={(id, blob) => dispatch({ type: "etapa", id, patch: { fotoId: guardarFoto(blob) } })}
            onRelatorioCliente={setRelatoAberto}
            onComentar={setRelatoComentado}
          />
        )}

        {tela === "equipe" && <PassoEquipe state={state} dispatch={dispatch} temEtapa={etapasTocadas(state, etapas).length > 0} />}
        {tela === "triagem" && <PassoTriagem state={state} dispatch={dispatch} />}
        {tela === "pend" && (
          <PassoPendencias
            state={state}
            dispatch={dispatch}
            hoje={hoje}
            erros={erros.pend}
            etapas={etapasQ.etapas}
            equipe={equipeQ.data ?? []}
          />
        )}
        {tela === "mat" && (
          <PassoMaterial
            state={state}
            dispatch={dispatch}
            erros={erros.mat}
            itens={itensQ.data ?? []}
            carregandoItens={itensQ.isLoading}
            onFoto={(id, blob) => dispatch({ type: "material", id, patch: { fotoId: guardarFoto(blob) } })}
          />
        )}
        {tela === "prazo" && <PassoPrazo state={state} dispatch={dispatch} hoje={hoje} erros={erros.prazo} />}
        {tela === "conf" && (
          <PassoConferir
            state={state}
            dispatch={dispatch}
            erros={erros}
            etapas={etapas}
            obra={obra}
            dia={dia}
            relator={relator}
            online={online}
            erroDeEnvio={erroDeEnvio}
          />
        )}
        {tela === "ok" && <PassoEnviado state={state} etapas={etapas} naFila={fila.aguardando.length} />}
      </Moldura>

      <Sheet open={state.modal} onOpenChange={(open) => !open && dispatch({ type: "modalFicar" })}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl font-extrabold">Pendência incompleta</SheetTitle>
            <SheetDescription className="text-[15px] font-medium text-muted-foreground">{aviso.texto}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            <BotaoPrincipal onClick={() => dispatch({ type: "modalFicar" })}>Voltar e preencher</BotaoPrincipal>
            {aviso.ligada && (
              <Opcao onClick={() => dispatch({ type: "modalParaAndamento" })}>Mudar a etapa para Em andamento</Opcao>
            )}
            {aviso.avulsa && <Opcao onClick={() => dispatch({ type: "modalDescartar" })}>Descartar a pendência vazia</Opcao>}
          </div>
        </SheetContent>
      </Sheet>
      {relatoComentado?.diario && obra && (
        <DiarioComentarSheet
          projectId={obra.id}
          contexto={{ dia: relatoComentado.diario.report_date, etapa: relatoComentado.description }}
          onClose={() => setRelatoComentado(null)}
        />
      )}
    </>
  );
}
