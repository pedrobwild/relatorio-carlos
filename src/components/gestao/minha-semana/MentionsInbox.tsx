/**
 * Pendências entre a equipe na Minha semana: o que marcaram com você
 * ("Pendências comigo"), o que você pediu e ainda está aberto, e o que está
 * atrasado nas obras em que você é o responsável.
 *
 * Tudo vem das menções em observações internas — nada aqui é do cliente.
 * Cartões em uma coluna no celular, com o botão Resolver à mão.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { AtSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResolveMentionSheet } from "@/components/internal-notes/NoteMentions";
import { useMinhasMencoes } from "@/hooks/useInternalNoteMentions";
import type { OpenInternalNoteMention } from "@/infra/repositories/internalNoteMentions.repository";
import { haQuantoTempo, mencaoAtrasada } from "@/lib/mencoes";
import { cn } from "@/lib/utils";

function MentionCard(props: {
  mention: OpenInternalNoteMention;
  /** Linha de quem: "Carla pediu" / "Com Sérgio". */
  quem: string;
  agora: Date;
  onResolver?: () => void;
}) {
  const { mention: m, agora } = props;
  const atrasada = mencaoAtrasada(m, agora);
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-3.5",
        atrasada ? "border-destructive/50" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Link
          to={`/obra/${m.project_id}`}
          className="min-h-[24px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {m.project?.name ?? "Obra"}
        </Link>
        <span className="text-muted-foreground">· {props.quem}</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
            atrasada
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <Clock className="h-3 w-3" aria-hidden="true" />
          {atrasada ? "Atrasada · " : ""}
          {haQuantoTempo(m.created_at, agora)}
        </span>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-foreground">{m.note?.body ?? ""}</p>
      {props.onResolver && (
        <Button type="button" className="min-h-[44px] self-start px-5" onClick={props.onResolver}>
          Resolver
        </Button>
      )}
    </li>
  );
}

function Grupo(props: { titulo: string; count: number; tone: "danger" | "info" | "muted"; children: React.ReactNode }) {
  const toneClass =
    props.tone === "danger"
      ? "bg-destructive/10 text-destructive border-destructive/25"
      : props.tone === "info"
        ? "bg-info/10 text-info border-info/25"
        : "bg-muted text-muted-foreground border-border";
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <AtSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">{props.titulo}</h2>
        <span
          className={cn(
            "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold tabular-nums",
            toneClass,
          )}
        >
          {props.count}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">{props.children}</ul>
    </section>
  );
}

export function MentionsInbox() {
  const { comigo, pediEmAberto, atrasadasNasMinhasObras, enabled, isError } = useMinhasMencoes();
  const [resolving, setResolving] = useState<OpenInternalNoteMention | null>(null);
  if (!enabled) return null;
  const agora = new Date();
  const vazio = comigo.length + pediEmAberto.length + atrasadasNasMinhasObras.length === 0;

  if (isError) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Não deu para carregar as pendências da equipe. Toque em Atualizar.
      </p>
    );
  }
  if (vazio) return null;

  return (
    <div className="space-y-8">
      {comigo.length > 0 && (
        <Grupo titulo="Pendências comigo" count={comigo.length} tone="danger">
          {comigo.map((m) => (
            <MentionCard
              key={m.id}
              mention={m}
              quem={`${m.requested_by_name} pediu`}
              agora={agora}
              onResolver={() => setResolving(m)}
            />
          ))}
        </Grupo>
      )}
      {pediEmAberto.length > 0 && (
        <Grupo titulo="Pedi e ainda está aberto" count={pediEmAberto.length} tone="info">
          {pediEmAberto.map((m) => (
            <MentionCard key={m.id} mention={m} quem={`Com ${m.mentioned_name}`} agora={agora} />
          ))}
        </Grupo>
      )}
      {atrasadasNasMinhasObras.length > 0 && (
        <Grupo titulo="Atrasadas nas minhas obras" count={atrasadasNasMinhasObras.length} tone="danger">
          {atrasadasNasMinhasObras.map((m) => (
            <MentionCard
              key={m.id}
              mention={m}
              quem={`${m.requested_by_name} pediu · com ${m.mentioned_name}`}
              agora={agora}
            />
          ))}
        </Grupo>
      )}
      <ResolveMentionSheet mention={resolving} context={resolving?.note?.body} onClose={() => setResolving(null)} />
    </div>
  );
}
