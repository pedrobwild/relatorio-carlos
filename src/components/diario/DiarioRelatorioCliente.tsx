/**
 * Relatório do cliente de uma etapa já relatada.
 *
 * O texto e a foto entram sozinhos no relatório semanal da obra no envio do
 * diário; esta tela mostra como o cliente vai ver e deixa ajustar o texto
 * enquanto o relatório da semana ainda não está visível para ele. Depois
 * disso, o ajuste é pelo relatório semanal.
 */
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useDiarioFotos, useSalvarTextoCliente } from "@/hooks/useDiarioObra";
import type { DiarioObraOption, DiarioRelatoRow } from "@/infra/repositories/diarioObra.repository";
import { mapError } from "@/lib/errorMapping";
import { metaDaObra, textoGerado } from "@/lib/diarioObra/formato";
import { diaCurto, LIMITE_TEXTO_CLIENTE, STATUS_LABEL, type EtapaCronograma } from "@/lib/diarioObra/regras";
import { toISODate } from "@/lib/hojeDia";
import { Cartao, LinkBotao, Nota, Rotulo, Selo, TOM_STATUS } from "./DiarioUi";

/** "sex 27/11, 18h" no horário do aparelho. */
function quando(iso: string): string {
  const d = new Date(iso);
  const hora = d.getMinutes() === 0 ? `${d.getHours()}h` : `${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}`;
  return `${diaCurto(toISODate(d))}, ${hora}`;
}

interface Props {
  relato: DiarioRelatoRow;
  obra: DiarioObraOption | undefined;
  etapas: readonly EtapaCronograma[];
  /** Recebe o rodapé pronto (botão principal), para a moldura da página. */
  children: (partes: { corpo: React.ReactNode; rodape: React.ReactNode }) => React.ReactNode;
  onVoltar: () => void;
}

export function DiarioRelatorioCliente({ relato, obra, etapas, children, onVoltar }: Props) {
  const liberaEm = relato.diario?.weekly?.available_at ?? null;
  const publicado = !!liberaEm && new Date(liberaEm) <= new Date();
  const semSemanal = !relato.diario?.weekly;
  const gerado = useMemo(() => textoGerado(relato, etapas), [relato, etapas]);
  const [texto, setTexto] = useState(relato.texto_cliente ?? gerado);
  const fotos = useDiarioFotos(useMemo(() => [relato.photo_path], [relato.photo_path]));
  const salvar = useSalvarTextoCliente(obra?.id ?? null);
  const mudou = texto.trim() !== (relato.texto_cliente ?? "").trim();

  const onSalvar = () => {
    if (!texto.trim()) {
      toast.error("Escreva o texto do relatório do cliente.");
      return;
    }
    salvar.mutate(
      { etapaId: relato.id, texto },
      {
        onSuccess: () => {
          toast.success("Texto do cliente salvo.");
          onVoltar();
        },
        onError: (e) => toast.error("Não deu para salvar o texto.", { description: mapError(e).userMessage }),
      },
    );
  };

  const corpo = (
    <>
      <div className="flex flex-col gap-0.5 rounded-2xl bg-foreground px-3.5 py-3 text-background">
        <p className="text-xs font-semibold opacity-80">Como o cliente vê no portal</p>
        <p className="text-base font-extrabold">
          {obra?.name ?? ""}
          {obra && metaDaObra(obra) ? ` · ${metaDaObra(obra)}` : ""}
        </p>
      </div>

      {publicado && (
        <div className="flex flex-col items-center gap-2.5 py-2 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success">
            <Check className="h-10 w-10 text-success-foreground" strokeWidth={3} aria-hidden="true" />
          </div>
          <h2 className="text-[22px] font-extrabold text-foreground">Publicado no portal do cliente</h2>
          <Nota>O cliente já vê este relatório no relatório semanal da obra.</Nota>
        </div>
      )}

      <Cartao>
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 break-words text-[19px] font-extrabold leading-tight text-foreground">{relato.description}</h2>
          <Selo tom={TOM_STATUS[relato.status]}>{STATUS_LABEL[relato.status]}</Selo>
        </div>
        {relato.diario && <Nota>Relatório de campo de {diaCurto(relato.diario.report_date)}</Nota>}

        <div className="grid grid-cols-3 gap-2">
          {(fotos.data ?? []).map((f) => (
            <img
              key={f.path}
              src={f.url}
              alt={`Foto da etapa ${relato.description}`}
              className="h-[72px] w-full rounded-lg border border-border object-cover"
            />
          ))}
          {!fotos.data?.length && (
            <div className="flex h-[72px] items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground">
              {fotos.isLoading ? "Carregando…" : "Foto 1"}
            </div>
          )}
        </div>

        <Rotulo htmlFor="diario-texto-cliente">Texto do relatório</Rotulo>
        {publicado || semSemanal ? (
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{relato.texto_cliente ?? gerado}</p>
        ) : (
          <>
            <textarea
              id="diario-texto-cliente"
              rows={9}
              maxLength={LIMITE_TEXTO_CLIENTE}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="min-h-[200px] w-full rounded-xl border-2 border-border bg-card p-3 text-base leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-2">
              <Nota className="flex-1">Gerado do relatório de campo. Equipe, pendências e material não entram. Você pode ajustar.</Nota>
              <LinkBotao onClick={() => setTexto(gerado)}>Gerar de novo</LinkBotao>
            </div>
          </>
        )}
      </Cartao>

      {!publicado && liberaEm && (
        <div className="rounded-xl border border-warning bg-warning/10 px-3.5 py-3 text-[15px] font-bold text-foreground">
          Liberado sozinho para o cliente em {quando(liberaEm)}, no relatório da semana. Vão só este texto e a foto.
        </div>
      )}
      {semSemanal && (
        <Nota>Este relato ficou só interno: a obra não tem datas para o relatório semanal do cliente.</Nota>
      )}
    </>
  );

  const rodape =
    publicado || semSemanal ? (
      <BotaoPrincipal onClick={onVoltar}>Voltar às etapas</BotaoPrincipal>
    ) : (
      <BotaoPrincipal onClick={onSalvar} disabled={salvar.isPending || !mudou}>
        {salvar.isPending ? "Salvando…" : mudou ? "Salvar texto do cliente" : "Texto já está no relatório da semana"}
      </BotaoPrincipal>
    );

  return <>{children({ corpo, rodape })}</>;
}

export function BotaoPrincipal(props: { children: React.ReactNode; onClick: () => void; disabled?: boolean; apagado?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={
        "min-h-[64px] w-full rounded-2xl text-lg font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 " +
        (props.apagado ? "bg-muted-foreground text-background" : "bg-primary text-primary-foreground")
      }
    >
      {props.children}
    </button>
  );
}
