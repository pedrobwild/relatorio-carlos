/**
 * Passo 2 do Diário de obra: etapas do cronograma da obra. Toque na etapa,
 * marque como ficou e tire a foto. Medição pede o tipo e, se não concluída,
 * o agendamento. Etapa que já tem relato mostra o atalho para o relatório do
 * cliente.
 */
import { useState, type Dispatch } from "react";
import { cn } from "@/lib/utils";
import { useDiarioFornecedores } from "@/hooks/useDiarioObra";
import type { DiarioRelatoRow } from "@/infra/repositories/diarioObra.repository";
import {
  diaCurto,
  etiquetaEtapa,
  marcoDaEtapa,
  relatoDaEtapa,
  STATUS_LABEL,
  TIPOS_MEDICAO,
  vaiParaOCliente,
  type DiarioAction,
  type DiarioState,
  type EtapaCronograma,
  type EtapaRelato,
  type StatusEtapa,
  type TipoMedicao,
} from "@/lib/diarioObra/regras";
import {
  BotaoFoto,
  CampoData,
  CampoTexto,
  Cartao,
  Chip,
  Erro,
  FaixaDeErros,
  Fileira,
  Nota,
  Opcao,
  Rotulo,
  Selo,
  TOM_STATUS,
} from "./DiarioUi";

const STATUS: StatusEtapa[] = ["concluida", "andamento", "impedida"];
const BUSCA_PADRAO: Record<TipoMedicao, string> = {
  marmoraria: "marmor",
  vidracaria: "vidr",
  marcenaria: "marcen",
};

function SeletorFornecedor(props: {
  tipo: TipoMedicao | null;
  fornecedorId: string | null;
  fornecedorNome: string | null;
  onPick: (id: string, nome: string) => void;
}) {
  const [termo, setTermo] = useState<string | null>(null);
  const busca = termo ?? (props.tipo ? BUSCA_PADRAO[props.tipo] : "");
  const { data = [], isLoading, isError } = useDiarioFornecedores(busca, true);
  const lista =
    props.fornecedorId && props.fornecedorNome && !data.some((f) => f.id === props.fornecedorId)
      ? [{ id: props.fornecedorId, nome: props.fornecedorNome, categoria: null }, ...data]
      : data;
  return (
    <>
      <CampoTexto
        value={termo ?? ""}
        onChange={setTermo}
        maxLength={40}
        placeholder="Buscar fornecedor pelo nome"
        ariaLabel="Buscar fornecedor da medição"
      />
      <Fileira>
        {lista.map((f) => (
          <Chip key={f.id} ativo={props.fornecedorId === f.id} onClick={() => props.onPick(f.id, f.nome)}>
            {f.nome}
          </Chip>
        ))}
      </Fileira>
      {isLoading && <Nota>Buscando fornecedores…</Nota>}
      {isError && <Nota>Não deu para carregar os fornecedores. Sem sinal, tente de novo quando voltar.</Nota>}
      {!isLoading && !isError && lista.length === 0 && <Nota>Nenhum fornecedor com esse nome no cadastro.</Nota>}
    </>
  );
}

interface Props {
  state: DiarioState;
  dispatch: Dispatch<DiarioAction>;
  /** Já ordenadas (previstas para o dia primeiro). */
  etapas: EtapaCronograma[];
  dia: string;
  hoje: string;
  erros: string[];
  relatos: Map<string, DiarioRelatoRow>;
  carregando: boolean;
  falhou: boolean;
  onFoto: (etapaId: string, blob: Blob) => void;
  onRelatorioCliente: (relato: DiarioRelatoRow) => void;
  /** Abre "Comentar e marcar" para um relato já enviado (só equipe). */
  onComentar?: (relato: DiarioRelatoRow) => void;
}

export function DiarioEtapas({ state, dispatch, etapas, dia, hoje, erros, relatos, carregando, falhou, onFoto, onRelatorioCliente, onComentar }: Props) {
  const tentou = !!state.tentou.etapas;

  return (
    <>
      <Nota>Etapas do cronograma desta obra. Toque na etapa e marque como ficou.</Nota>
      {tentou && erros.length > 0 && <FaixaDeErros titulo="Falta para continuar:" itens={erros} />}
      {carregando && <Nota>Carregando o cronograma…</Nota>}
      {falhou && <Nota>Não deu para carregar o cronograma desta obra. Confira o sinal e volte a esta tela.</Nota>}
      {!carregando && !falhou && etapas.length === 0 && (
        <Nota>Esta obra ainda não tem etapas em aberto no cronograma.</Nota>
      )}

      {etapas.map((d) => {
        const e = relatoDaEtapa(state, d.id);
        const tocada = !!e.status;
        const aberta = state.aberta === d.id;
        const marco = marcoDaEtapa(d.description);
        const relato = relatos.get(d.id);
        const publicado = !!relato?.diario?.weekly?.available_at && new Date(relato.diario.weekly.available_at) <= new Date();
        const semFoto = tentou && tocada && !e.fotoId;
        const medicao = marco === "medicao" && tocada;
        const set = (patch: Partial<EtapaRelato>) => dispatch({ type: "etapa", id: d.id, patch });

        return (
          <Cartao key={d.id} erro={semFoto} className={cn(aberta && !semFoto && "border-foreground")}>
            <button
              type="button"
              aria-expanded={aberta}
              onClick={() => dispatch({ type: "abrirEtapa", id: d.id })}
              className="flex min-h-[56px] w-full items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="break-words text-[17px] font-bold leading-tight text-foreground">{d.description}</span>
                <span className="text-xs font-semibold text-muted-foreground">{etiquetaEtapa(d, dia, !!relato)}</span>
              </span>
              <Selo tom={e.status ? TOM_STATUS[e.status] : "neutro"}>{e.status ? STATUS_LABEL[e.status] : "Toque"}</Selo>
            </button>

            {relato?.diario && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-warning/50 bg-warning/10 p-3">
                <p className="text-sm font-semibold text-foreground">
                  Relatório cadastrado em {diaCurto(relato.diario.report_date)}: {STATUS_LABEL[relato.status].toLowerCase()},{" "}
                  {relato.diario.team_count} pessoa(s), 1 foto.
                </p>
                {vaiParaOCliente(relato.status) ? (
                  <Opcao ativo onClick={() => onRelatorioCliente(relato)} className="min-h-[60px] font-extrabold">
                    {publicado ? "Publicado no portal · ver" : "Gerar relatório do cliente"}
                  </Opcao>
                ) : (
                  <Nota>Etapa impedida fica só no relatório interno. Não vai para o cliente.</Nota>
                )}
                {onComentar && (
                  <Opcao onClick={() => onComentar(relato)} className="min-h-[52px]">
                    Comentar e marcar alguém
                  </Opcao>
                )}
              </div>
            )}

            {aberta && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {STATUS.map((st) => (
                    <Opcao
                      key={st}
                      ativo={e.status === st}
                      tom={TOM_STATUS[st]}
                      onClick={() => dispatch({ type: "status", id: d.id, status: st })}
                      className="min-h-[64px] px-1 text-[13px] leading-tight min-[400px]:text-[15px]"
                    >
                      {STATUS_LABEL[st]}
                    </Opcao>
                  ))}
                </div>

                {tocada && (
                  <>
                    <BotaoFoto
                      temFoto={!!e.fotoId}
                      rotulo="Tirar foto (obrigatória)"
                      falta={semFoto}
                      onFoto={(blob) => onFoto(d.id, blob)}
                    />
                    {semFoto && <Erro>Foto obrigatória nesta etapa.</Erro>}
                  </>
                )}

                {e.status === "impedida" && (
                  <Nota className="font-semibold text-destructive">
                    Impedida abre uma pendência. Você preenche responsável e prazo na tela de pendências.
                  </Nota>
                )}
                {marco === "eletrica" && tocada && (
                  <Nota className="font-semibold text-foreground">Marco da obra: concluir esta etapa define o INÍCIO REAL.</Nota>
                )}

                {medicao && (
                  <>
                    <Rotulo className="mt-1">Tipo de medição</Rotulo>
                    <Fileira>
                      {TIPOS_MEDICAO.map(([k, label]) => (
                        <Chip key={k} ativo={e.tipo === k} falta={tentou && !e.tipo} onClick={() => set({ tipo: k })}>
                          {label}
                        </Chip>
                      ))}
                    </Fileira>
                    {tentou && !e.tipo && <Erro>Escolha o tipo de medição.</Erro>}
                    {e.tipo === "marcenaria" && (
                      <Nota className="font-semibold text-foreground">Medição de marcenaria não conta como início da obra.</Nota>
                    )}
                    {(e.tipo === "marmoraria" || e.tipo === "vidracaria") && e.status === "concluida" && (
                      <Nota className="font-semibold text-foreground">Marco da obra: concluir esta medição define o INÍCIO REAL.</Nota>
                    )}

                    {e.status !== "concluida" && (
                      <>
                        <Rotulo className="mt-1">Medição foi agendada?</Rotulo>
                        <div className="grid grid-cols-2 gap-2">
                          <Opcao
                            ativo={!e.agendada}
                            onClick={() => set({ agendada: false, dataMedicao: null, fornecedorId: null, fornecedorNome: null })}
                          >
                            Não
                          </Opcao>
                          <Opcao ativo={e.agendada} onClick={() => set({ agendada: true })}>
                            Sim
                          </Opcao>
                        </div>
                        {e.agendada && (
                          <>
                            <Rotulo>Data agendada</Rotulo>
                            <CampoData hoje={hoje} value={e.dataMedicao} onChange={(iso) => set({ dataMedicao: iso })} />
                            {tentou && !e.dataMedicao && <Erro>Informe a data agendada.</Erro>}
                            <Rotulo>Fornecedor</Rotulo>
                            <SeletorFornecedor
                              tipo={e.tipo}
                              fornecedorId={e.fornecedorId}
                              fornecedorNome={e.fornecedorNome}
                              onPick={(id, nome) => set({ fornecedorId: id, fornecedorNome: nome })}
                            />
                            {tentou && !e.fornecedorId && <Erro>Informe o fornecedor da medição.</Erro>}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Cartao>
        );
      })}

      <Opcao ativo={state.nenhumaEtapa} onClick={() => dispatch({ type: "nenhumaEtapa" })}>
        Nenhuma etapa avançou hoje
      </Opcao>
    </>
  );
}
