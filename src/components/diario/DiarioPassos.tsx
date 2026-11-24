/**
 * Passos do Diário de obra fora o de etapas: quem e onde, equipe, triagem,
 * pendências, material, mudança de prazo, conferência e a tela "Pronto".
 * Cada um só desenha o estado e despacha ações de `regras.ts`.
 */
import type { Dispatch } from "react";
import { Check } from "lucide-react";
import type { DiarioItemMaterial, DiarioObraOption, DiarioPessoa } from "@/infra/repositories/diarioObra.repository";
import {
  ATALHOS_PENDENCIA,
  AVISADO_OPCOES,
  CHEGOU_OPCOES,
  CONFERE_OPCOES,
  diaCurto,
  efeitoDaEtapa,
  errosComTela,
  etapasTocadas,
  FUNCAO_RESUMO,
  FUNCOES,
  LIMITE_NOMES,
  LIMITE_TEXTO_CURTO,
  linhasDoEnvio,
  MOTIVOS_PRAZO,
  notaDeEnvio,
  pendenciaTravadaEmSim,
  relatoDaEtapa,
  RESPONSAVEIS_TERCEIROS,
  resumoMaterial,
  resumoPendencia,
  resumoPrazo,
  STATUS_LABEL,
  temPendenciaEfetivo,
  TERCEIROS,
  type DiarioAction,
  type DiarioState,
  type Erros,
  type EtapaCronograma,
} from "@/lib/diarioObra/regras";
import { metaDaObra } from "@/lib/diarioObra/formato";
import { shiftISODate } from "@/lib/hojeDia";
import {
  BotaoFoto,
  CampoData,
  CampoTexto,
  Cartao,
  Chip,
  Erro,
  FaixaDeErros,
  Fileira,
  LinkBotao,
  Nota,
  Opcao,
  Rotulo,
  Selo,
  TOM_STATUS,
} from "./DiarioUi";

interface Base {
  state: DiarioState;
  dispatch: Dispatch<DiarioAction>;
}

// ---------------------------------------------------------------------------
// 1. Quem e onde
// ---------------------------------------------------------------------------
export function PassoIdentificacao(
  props: Base & { hoje: string; obras: DiarioObraOption[]; carregando: boolean; falhou: boolean; relator: string },
) {
  const { state, dispatch, hoje } = props;
  const erroObra = !!state.tentou.id && !state.obraId;
  return (
    <>
      <Cartao>
        <Rotulo>Data do relato</Rotulo>
        <Fileira>
          <Opcao ativo={state.dataEscolha === "hoje"} onClick={() => dispatch({ type: "data", escolha: "hoje" })}>
            Hoje · {diaCurto(hoje)}
          </Opcao>
          <Opcao ativo={state.dataEscolha === "ontem"} onClick={() => dispatch({ type: "data", escolha: "ontem" })}>
            Ontem · {diaCurto(shiftISODate(hoje, -1))}
          </Opcao>
        </Fileira>
      </Cartao>

      <Cartao erro={erroObra}>
        <Rotulo>Obra</Rotulo>
        {props.obras.map((o) => (
          <Opcao
            key={o.id}
            ativo={state.obraId === o.id}
            onClick={() => dispatch({ type: "obra", id: o.id })}
            className="min-h-[64px] justify-start"
          >
            <span className="min-w-0 flex-1 break-words text-left font-extrabold">{o.name}</span>
            <span className="shrink-0 text-[13px] font-medium">{metaDaObra(o)}</span>
          </Opcao>
        ))}
        {props.carregando && <Nota>Carregando as obras…</Nota>}
        {props.falhou && <Nota>Não deu para carregar as obras. Confira o sinal e abra esta tela de novo.</Nota>}
        {!props.carregando && !props.falhou && props.obras.length === 0 && (
          <Nota>Você ainda não tem obra em andamento na sua lista.</Nota>
        )}
        <Nota>Lista fechada. Pedido e unidade vêm do cadastro da obra.</Nota>
        {erroObra && <Erro>Escolha a obra para seguir.</Erro>}
      </Cartao>

      <Cartao>
        <Rotulo>Quem está relatando</Rotulo>
        <p className="text-lg font-bold text-foreground">
          {props.relator} <span className="text-[13px] font-medium text-muted-foreground">· do login</span>
        </p>
        <Fileira>
          {FUNCOES.map(([k, label]) => (
            <Opcao
              key={k}
              ativo={state.funcao === k}
              onClick={() => dispatch({ type: "funcao", funcao: k })}
              className="flex-1 px-2 text-[15px]"
            >
              {label}
            </Opcao>
          ))}
        </Fileira>
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3. Equipe
// ---------------------------------------------------------------------------
export function PassoEquipe({ state, dispatch, temEtapa }: Base & { temEtapa: boolean }) {
  const tentou = !!state.tentou.equipe;
  const erroQtd = tentou && temEtapa && state.qtd < 1;
  const erroNomes = tentou && (temEtapa || state.qtd > 0) && !state.nomes.trim();
  return (
    <>
      <Cartao erro={erroQtd}>
        <Rotulo>Quantas pessoas estiveram na obra</Rotulo>
        <div className="flex items-center justify-between gap-3">
          <Opcao ariaLabel="Menos uma pessoa" onClick={() => dispatch({ type: "qtd", delta: -1 })} className="min-h-[80px] w-20 px-0 text-4xl">
            −
          </Opcao>
          <p className="text-6xl font-extrabold leading-none text-foreground" aria-live="polite">
            {state.qtd > 0 ? state.qtd : "—"}
          </p>
          <Opcao ariaLabel="Mais uma pessoa" onClick={() => dispatch({ type: "qtd", delta: 1 })} className="min-h-[80px] w-20 px-0 text-4xl">
            +
          </Opcao>
        </div>
        {erroQtd && <Erro>Informe quantas pessoas estiveram na obra.</Erro>}
      </Cartao>

      <Cartao>
        <Rotulo htmlFor="diario-nomes">Nomes de quem esteve na obra</Rotulo>
        <CampoTexto
          id="diario-nomes"
          value={state.nomes}
          onChange={(nomes) => dispatch({ type: "nomes", nomes })}
          maxLength={LIMITE_NOMES}
          placeholder="Ex.: nome 1, nome 2, nome 3"
          erro={erroNomes}
        />
        {erroNomes && <Erro>Informe o nome de quem esteve na obra.</Erro>}
        <Nota>Obrigatório. Os nomes ficam só no relatório interno e não aparecem no relatório do cliente.</Nota>
        <Rotulo className="mt-1">Terceiros presentes (opcional)</Rotulo>
        <Fileira>
          {TERCEIROS.map((t) => (
            <Chip key={t} ativo={state.terceiros.includes(t)} onClick={() => dispatch({ type: "terceiro", nome: t })}>
              {t}
            </Chip>
          ))}
        </Fileira>
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------------------------
// 4. Algo mais hoje?
// ---------------------------------------------------------------------------
export function PassoTriagem({ state, dispatch }: Base) {
  const travada = pendenciaTravadaEmSim(state);
  const linhas = [
    {
      chave: "temPendencia" as const,
      titulo: "Tem pendência?",
      sub: "Abre: descrição, responsável, prazo e se trava a obra.",
      valor: temPendenciaEfetivo(state),
      travada,
    },
    {
      chave: "temMaterial" as const,
      titulo: "Recebeu material hoje?",
      sub: "Abre: item, se chegou e se confere com o executivo.",
      valor: state.temMaterial,
      travada: false,
    },
    {
      chave: "temPrazo" as const,
      titulo: "Mudou a data de entrega?",
      sub: "Abre: nova data, motivo e aviso ao cliente.",
      valor: state.temPrazo,
      travada: false,
    },
  ];
  return (
    <>
      <Nota>Se nada disso aconteceu, toque em Conferir e enviar. Cada “Sim” abre só os campos daquele assunto.</Nota>
      {linhas.map((r) => (
        <Cartao key={r.chave}>
          <h2 className="text-lg font-extrabold text-foreground">{r.titulo}</h2>
          <Nota>{r.sub}</Nota>
          <div className="grid grid-cols-2 gap-2">
            <Opcao
              ativo={!r.valor}
              disabled={r.travada}
              onClick={() => dispatch({ type: "triagem", chave: r.chave, valor: false })}
              className="min-h-[64px]"
            >
              Não
            </Opcao>
            <Opcao ativo={r.valor} onClick={() => dispatch({ type: "triagem", chave: r.chave, valor: true })} className="min-h-[64px]">
              Sim
            </Opcao>
          </div>
          {r.travada && <Nota className="font-semibold text-destructive">Travado em Sim: há etapa impedida marcada.</Nota>}
        </Cartao>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// 4a. Pendências
// ---------------------------------------------------------------------------
export function PassoPendencias(
  props: Base & { hoje: string; erros: string[]; etapas: readonly EtapaCronograma[]; equipe: DiarioPessoa[] },
) {
  const { state, dispatch, hoje } = props;
  const tentou = !!state.tentou.pend;
  return (
    <>
      {tentou && props.erros.length > 0 && <FaixaDeErros titulo="Não dá para seguir. Falta preencher:" itens={props.erros} />}
      {state.pendencias.map((p, i) => {
        const etapa = p.etapaId ? props.etapas.find((e) => e.id === p.etapaId) : null;
        const set = (patch: Partial<typeof p>) => dispatch({ type: "pendencia", id: p.id, patch });
        const semDesc = tentou && !p.descricao.trim();
        return (
          <Cartao key={p.id}>
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-extrabold text-foreground">Pendência {i + 1}</h2>
              {!p.etapaId && <LinkBotao onClick={() => dispatch({ type: "removerPendencia", id: p.id })}>Remover</LinkBotao>}
            </div>
            {p.etapaId && <Nota className="font-semibold text-destructive">Vem da etapa impedida: {etapa?.description ?? ""}</Nota>}

            <Rotulo>O que está pendente</Rotulo>
            <CampoTexto
              value={p.descricao}
              onChange={(descricao) => set({ descricao })}
              maxLength={LIMITE_TEXTO_CURTO}
              placeholder="Em poucas palavras"
              ariaLabel="Descrição da pendência"
              erro={semDesc}
            />
            <Fileira>
              {ATALHOS_PENDENCIA.map((t) => (
                <Chip key={t} onClick={() => set({ descricao: t })}>
                  {t}
                </Chip>
              ))}
            </Fileira>
            {semDesc && <Erro>Descreva a pendência.</Erro>}

            <Rotulo>Responsável pela solução</Rotulo>
            <Fileira>
              {props.equipe.map((pessoa) => (
                <Chip
                  key={pessoa.user_id}
                  ativo={p.responsavelUserId === pessoa.user_id}
                  falta={tentou && !p.responsavel}
                  onClick={() => set({ responsavel: pessoa.name, responsavelUserId: pessoa.user_id })}
                >
                  {pessoa.name}
                </Chip>
              ))}
              {RESPONSAVEIS_TERCEIROS.map((t) => (
                <Chip
                  key={t}
                  ativo={!p.responsavelUserId && p.responsavel === t}
                  falta={tentou && !p.responsavel}
                  onClick={() => set({ responsavel: t, responsavelUserId: null })}
                >
                  {t}
                </Chip>
              ))}
            </Fileira>
            {tentou && !p.responsavel && <Erro>Escolha quem resolve.</Erro>}

            <Rotulo>Prazo de solução</Rotulo>
            <CampoData hoje={hoje} value={p.prazo} onChange={(prazo) => set({ prazo })} falta={tentou} />
            {tentou && !p.prazo && <Erro>Informe o prazo de solução.</Erro>}

            <Rotulo>Trava a obra?</Rotulo>
            <div className="grid grid-cols-2 gap-2">
              <Opcao
                ativo={p.trava === true}
                tom="alerta"
                falta={tentou && p.trava === null}
                onClick={() => set({ trava: true })}
                className="min-h-[64px]"
              >
                Sim, trava
              </Opcao>
              <Opcao ativo={p.trava === false} falta={tentou && p.trava === null} onClick={() => set({ trava: false })} className="min-h-[64px]">
                Não trava
              </Opcao>
            </div>
            {tentou && p.trava === null && <Erro>Diga se trava ou não.</Erro>}
          </Cartao>
        );
      })}
      <Opcao onClick={() => dispatch({ type: "novaPendencia" })} className="border-dashed">
        + Outra pendência
      </Opcao>
    </>
  );
}

// ---------------------------------------------------------------------------
// 4b. Material recebido
// ---------------------------------------------------------------------------
export function PassoMaterial(
  props: Base & {
    erros: string[];
    itens: DiarioItemMaterial[];
    carregandoItens: boolean;
    onFoto: (materialId: string, blob: Blob) => void;
  },
) {
  const { state, dispatch } = props;
  const tentou = !!state.tentou.mat;
  return (
    <>
      {tentou && props.erros.length > 0 && <FaixaDeErros titulo="Falta preencher:" itens={props.erros} />}
      {state.materiais.map((m, i) => {
        const set = (patch: Partial<typeof m>) => dispatch({ type: "material", id: m.id, patch });
        const semItem = tentou && !m.item?.trim();
        const foraDaLista = !m.purchaseId && !!m.item;
        return (
          <Cartao key={m.id}>
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-extrabold text-foreground">Item {i + 1}</h2>
              {state.materiais.length > 1 && (
                <LinkBotao onClick={() => dispatch({ type: "removerMaterial", id: m.id })}>Remover</LinkBotao>
              )}
            </div>

            <Rotulo>Item recebido</Rotulo>
            <Nota>Itens de compra desta obra.</Nota>
            <Fileira>
              {props.itens.map((it) => (
                <Chip
                  key={it.id}
                  ativo={m.purchaseId === it.id}
                  falta={semItem}
                  onClick={() => set({ item: it.item_name, purchaseId: it.id })}
                >
                  {it.item_name}
                </Chip>
              ))}
            </Fileira>
            {props.carregandoItens && <Nota>Carregando os itens…</Nota>}
            {!props.carregandoItens && props.itens.length === 0 && <Nota>Esta obra não tem itens de compra cadastrados.</Nota>}
            <CampoTexto
              value={foraDaLista ? (m.item ?? "") : ""}
              onChange={(item) => set({ item: item || null, purchaseId: null })}
              maxLength={LIMITE_TEXTO_CURTO}
              placeholder="Não está na lista? Escreva o item"
              ariaLabel="Item fora da lista"
              erro={semItem}
            />
            {semItem && <Erro>Escolha o item.</Erro>}

            <Rotulo>Chegou?</Rotulo>
            <div className="grid grid-cols-3 gap-2">
              {CHEGOU_OPCOES.map(([k, label]) => (
                <Opcao
                  key={k}
                  ativo={m.chegou === k}
                  falta={tentou && !m.chegou}
                  onClick={() => dispatch({ type: "chegou", id: m.id, valor: k })}
                  className="min-h-[60px] px-1.5"
                >
                  {label}
                </Opcao>
              ))}
            </div>
            {tentou && !m.chegou && <Erro>Diga se chegou.</Erro>}

            {(m.chegou === "sim" || m.chegou === "parcial") && (
              <>
                <Rotulo>Confere com o executivo?</Rotulo>
                <div className="grid grid-cols-3 gap-2">
                  {CONFERE_OPCOES.map(([k, label]) => (
                    <Opcao
                      key={k}
                      ativo={m.confere === k}
                      tom={k === "div" ? "alerta" : "padrao"}
                      falta={tentou && !m.confere}
                      onClick={() => dispatch({ type: "confere", id: m.id, valor: k })}
                      className="min-h-[60px] px-1.5 text-[15px]"
                    >
                      {label}
                    </Opcao>
                  ))}
                </div>
                {tentou && !m.confere && <Erro>Marque se confere, diverge ou não foi conferido.</Erro>}
              </>
            )}

            {m.confere === "div" && (
              <>
                <BotaoFoto
                  temFoto={!!m.fotoId}
                  rotulo="Tirar foto da divergência"
                  falta={tentou && !m.fotoId}
                  onFoto={(blob) => props.onFoto(m.id, blob)}
                />
                {tentou && !m.fotoId && <Erro>Foto da divergência é obrigatória.</Erro>}
                <Rotulo>O que está divergente</Rotulo>
                <CampoTexto
                  value={m.divergencia}
                  onChange={(divergencia) => set({ divergencia })}
                  maxLength={LIMITE_TEXTO_CURTO}
                  placeholder="Ex.: pedido x recebido"
                  ariaLabel="Descrição da divergência"
                  erro={tentou && !m.divergencia.trim()}
                />
                {tentou && !m.divergencia.trim() && <Erro>Descreva a divergência.</Erro>}
              </>
            )}
          </Cartao>
        );
      })}
      <Opcao onClick={() => dispatch({ type: "novoMaterial" })} className="border-dashed">
        + Outro item
      </Opcao>
    </>
  );
}

// ---------------------------------------------------------------------------
// 4c. Mudança de prazo
// ---------------------------------------------------------------------------
export function PassoPrazo({ state, dispatch, hoje, erros }: Base & { hoje: string; erros: string[] }) {
  const tentou = !!state.tentou.prazo;
  const p = state.prazo;
  return (
    <>
      {tentou && erros.length > 0 && <FaixaDeErros titulo="Falta preencher:" itens={erros} />}
      <Cartao>
        <Rotulo>Nova data de entrega</Rotulo>
        <CampoData hoje={hoje} value={p.data} onChange={(data) => dispatch({ type: "prazo", patch: { data } })} falta={tentou} />
        {tentou && !p.data && <Erro>Informe a nova data.</Erro>}

        <Rotulo>Motivo</Rotulo>
        <Fileira>
          {MOTIVOS_PRAZO.map(([k, label]) => (
            <Chip key={k} ativo={p.motivo === k} falta={tentou && !p.motivo} onClick={() => dispatch({ type: "prazo", patch: { motivo: k } })}>
              {label}
            </Chip>
          ))}
        </Fileira>
        {tentou && !p.motivo && <Erro>Escolha o motivo.</Erro>}

        <Rotulo>Cliente já foi avisado?</Rotulo>
        <div className="grid grid-cols-3 gap-2">
          {AVISADO_OPCOES.map(([k, label]) => (
            <Opcao
              key={k}
              ativo={p.avisado === k}
              falta={tentou && !p.avisado}
              onClick={() => dispatch({ type: "prazo", patch: { avisado: k } })}
              className="min-h-[60px] px-1.5 text-[15px]"
            >
              {label}
            </Opcao>
          ))}
        </div>
        {tentou && !p.avisado && <Erro>Diga se o cliente foi avisado.</Erro>}
      </Cartao>
    </>
  );
}

// ---------------------------------------------------------------------------
// 5. Conferir e enviar
// ---------------------------------------------------------------------------
function Bloco({ titulo, onEditar, children }: { titulo: string; onEditar: () => void; children: React.ReactNode }) {
  return (
    <Cartao>
      <div className="flex items-center">
        <Rotulo className="flex-1">{titulo}</Rotulo>
        <LinkBotao onClick={onEditar}>Editar</LinkBotao>
      </div>
      {children}
    </Cartao>
  );
}

const Linha = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 border-t border-border pt-2.5">{children}</div>
);

export function PassoConferir(
  props: Base & {
    erros: Erros;
    etapas: readonly EtapaCronograma[];
    obra: DiarioObraOption | undefined;
    dia: string;
    relator: string;
    online: boolean;
    erroDeEnvio: string | null;
  },
) {
  const { state, dispatch, dia } = props;
  const lista = errosComTela(props.erros);
  const tocadas = etapasTocadas(state, props.etapas);
  const ir = (tela: DiarioState["tela"]) => dispatch({ type: "ir", tela });
  const nada = state.pendencias.length === 0 && state.materiais.length === 0 && !state.temPrazo;
  const prazo = resumoPrazo(state.prazo);
  return (
    <>
      {lista.length === 0 && !props.erroDeEnvio && (
        <div className="rounded-2xl border border-success bg-success/10 px-4 py-3.5 text-base font-bold text-foreground">
          Tudo preenchido. Confira e envie.
        </div>
      )}
      {props.erroDeEnvio && <FaixaDeErros titulo="O relato não foi aceito:" itens={[props.erroDeEnvio]} />}
      {!!state.tentou.conf && lista.length > 0 && (
        <FaixaDeErros titulo="Falta corrigir antes de enviar:">
          {lista.map((m) => (
            <div key={`${m.tela}-${m.texto}`} className="flex items-center gap-2">
              <p className="flex-1 text-sm font-medium text-destructive">{m.texto}</p>
              <LinkBotao onClick={() => ir(m.tela)}>Corrigir</LinkBotao>
            </div>
          ))}
        </FaixaDeErros>
      )}

      <Bloco titulo="Identificação" onEditar={() => ir("id")}>
        <p className="text-xl font-extrabold text-foreground">{props.obra?.name ?? "[sem obra]"}</p>
        {props.obra && metaDaObra(props.obra) && <Nota>{metaDaObra(props.obra)}</Nota>}
        <Nota>
          {state.dataEscolha === "hoje" ? "Hoje" : "Ontem"} · {diaCurto(dia, true)} · {props.relator}, {FUNCAO_RESUMO[state.funcao]}
        </Nota>
      </Bloco>

      <Bloco titulo="Etapas do dia" onEditar={() => ir("etapas")}>
        {tocadas.length === 0 && state.nenhumaEtapa && <Nota>Nenhuma etapa avançou hoje.</Nota>}
        {tocadas.map((d) => {
          const e = relatoDaEtapa(state, d.id);
          if (!e.status) return null;
          return (
            <Linha key={d.id}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 break-words text-base font-bold text-foreground">{d.description}</p>
                <Selo tom={TOM_STATUS[e.status]}>{STATUS_LABEL[e.status]}</Selo>
              </div>
              <Nota>{efeitoDaEtapa(d, e, dia)}</Nota>
            </Linha>
          );
        })}
      </Bloco>

      <Bloco titulo="Equipe" onEditar={() => ir("equipe")}>
        <p className="text-lg font-bold text-foreground">{state.qtd} pessoa(s) na obra</p>
        <Nota>
          {state.nomes ? `Nomes: ${state.nomes} · ` : ""}
          {state.terceiros.length > 0 ? `Terceiros: ${state.terceiros.join(", ")}` : "Sem terceiros informados"}
        </Nota>
      </Bloco>

      <Bloco titulo="Pendências, material e prazo" onEditar={() => ir("triagem")}>
        {nada && <p className="text-base font-bold text-foreground">Nada a registrar</p>}
        {state.pendencias.map((p) => {
          const r = resumoPendencia(p);
          return (
            <Linha key={p.id}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 break-words text-base font-bold text-foreground">{r.titulo}</p>
                <Selo tom={r.tom}>{r.selo}</Selo>
              </div>
              <Nota>{r.meta}</Nota>
            </Linha>
          );
        })}
        {state.materiais.map((m) => {
          const r = resumoMaterial(m);
          return (
            <Linha key={m.id}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 break-words text-base font-bold text-foreground">{r.titulo}</p>
                <Selo tom={r.tom}>{r.selo}</Selo>
              </div>
              <Nota>{r.meta}</Nota>
            </Linha>
          );
        })}
        {state.temPrazo && (
          <Linha>
            <p className="text-base font-bold text-foreground">{prazo.titulo}</p>
            <Nota>{prazo.meta}</Nota>
          </Linha>
        )}
      </Bloco>

      <Nota>{notaDeEnvio(props.online)}</Nota>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pronto
// ---------------------------------------------------------------------------
export function PassoEnviado({ state, etapas, naFila }: { state: DiarioState; etapas: readonly EtapaCronograma[]; naFila: number }) {
  return (
    <>
      <div className="flex flex-col items-center gap-3.5 pb-2 pt-6 text-center">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-success">
          <Check className="h-12 w-12 text-success-foreground" strokeWidth={3} aria-hidden="true" />
        </div>
        <h2 className="text-[26px] font-extrabold text-foreground">{state.enviadoOffline ? "Salvo no aparelho" : "Relato enviado"}</h2>
        <Nota className="max-w-[300px]">
          {state.enviadoOffline
            ? `Está na fila (${Math.max(1, naFila)}). Envia sozinho quando voltar o sinal. Pode seguir para a próxima obra.`
            : "Obrigado. Pode seguir para a próxima obra."}
        </Nota>
      </div>
      <Cartao>
        <Rotulo>O que segue para a planilha</Rotulo>
        {linhasDoEnvio(state, etapas).map((l) => (
          <p key={l} className="border-t border-border pt-2.5 text-base font-semibold text-foreground">
            {l}
          </p>
        ))}
      </Cartao>
    </>
  );
}
