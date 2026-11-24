/**
 * Pessoas marcadas em uma observação interna e a situação de cada pendência:
 * aberta (há quanto tempo, destacada se passou de 24 horas úteis) ou
 * resolvida (por quem, quando e com que resposta). Quem foi marcado resolve
 * daqui mesmo.
 */
import { useState } from "react";
import { AtSign, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useResolveMention } from "@/hooks/useInternalNoteMentions";
import { RESOLUTION_NOTE_MAX_LENGTH, type InternalNoteMention } from "@/infra/repositories/internalNoteMentions.repository";
import { haQuantoTempo, mencaoAtrasada } from "@/lib/mencoes";
import { cn } from "@/lib/utils";
import { formatNoteDateTime } from "./internalNoteMeta";

/** Gaveta "Resolver pendência": resposta opcional e confirmação. */
export function ResolveMentionSheet(props: {
  mention: Pick<InternalNoteMention, "id" | "requested_by_name"> | null;
  /** Texto da observação, para a pessoa saber o que está resolvendo. */
  context?: string | null;
  onClose: () => void;
}) {
  const [resposta, setResposta] = useState("");
  const resolve = useResolveMention();
  const close = () => {
    setResposta("");
    props.onClose();
  };
  return (
    <Sheet open={!!props.mention} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg font-bold">Resolver pendência</SheetTitle>
          <SheetDescription>
            {props.mention?.requested_by_name ? `${props.mention.requested_by_name} é avisado(a) da resolução.` : ""}
          </SheetDescription>
        </SheetHeader>
        {props.context && (
          <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 text-sm text-foreground">
            {props.context}
          </p>
        )}
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="resolver-resposta">Resposta (opcional)</Label>
          <Textarea
            id="resolver-resposta"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={3}
            maxLength={RESOLUTION_NOTE_MAX_LENGTH}
            placeholder="Ex.: material chega quinta de manhã."
            className="text-base"
          />
        </div>
        <SheetFooter className="mt-4 flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="min-h-[48px] flex-1 sm:flex-none" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-[48px] flex-1 sm:flex-none"
            disabled={resolve.isPending}
            onClick={() =>
              props.mention &&
              resolve.mutate({ mentionId: props.mention.id, resposta: resposta.trim() || null }, { onSuccess: close })
            }
          >
            {resolve.isPending ? "Salvando…" : "Marcar como resolvida"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function NoteMentions(props: { mentions: InternalNoteMention[]; currentUserId?: string | null; noteBody: string }) {
  const [resolving, setResolving] = useState<InternalNoteMention | null>(null);
  if (props.mentions.length === 0) return null;
  const agora = new Date();

  return (
    <>
      <ul className="mt-2 space-y-1.5" aria-label="Pessoas marcadas">
        {props.mentions.map((m) => {
          const resolvida = !!m.resolved_at;
          const atrasada = mencaoAtrasada(m, agora);
          const minha = m.mentioned_user_id === props.currentUserId;
          return (
            <li
              key={m.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                resolvida
                  ? "border-border bg-muted/40 text-muted-foreground"
                  : atrasada
                    ? "border-destructive/40 bg-destructive/10 text-foreground"
                    : "border-info/30 bg-info/10 text-foreground",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="break-words">{m.mentioned_name}</span>
                </span>
                {resolvida ? (
                  <span className="inline-flex items-start gap-1">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                    <span className="break-words">
                      Resolvida por {m.resolved_by_name ?? m.mentioned_name} em {formatNoteDateTime(m.resolved_at as string)}
                      {m.resolution_note ? `: ${m.resolution_note}` : ""}
                    </span>
                  </span>
                ) : (
                  <span className={cn("inline-flex items-center gap-1", atrasada && "font-semibold text-destructive")}>
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {atrasada ? "Atrasada · aberta " : "Aberta "}
                    {haQuantoTempo(m.created_at, agora)}
                  </span>
                )}
              </div>
              {!resolvida && minha && (
                <Button type="button" size="sm" className="h-11 shrink-0 px-4" onClick={() => setResolving(m)}>
                  Resolver
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <ResolveMentionSheet mention={resolving} context={props.noteBody} onClose={() => setResolving(null)} />
    </>
  );
}
