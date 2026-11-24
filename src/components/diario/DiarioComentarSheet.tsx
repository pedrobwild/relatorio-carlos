/**
 * "Comentar e marcar" a partir de um relato do diário.
 *
 * Cria uma observação interna na obra (só equipe; o cliente nunca vê) já
 * dizendo de qual dia e etapa do diário é, e marca quem precisa agir. A
 * pendência aparece em "Pendências comigo" e a pessoa é avisada.
 */
import { useState } from "react";
import { AtSign, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MentionPicker, type MentionPerson } from "@/components/internal-notes/MentionPicker";
import { useAuth } from "@/hooks/useAuth";
import { useSetNoteMentions } from "@/hooks/useInternalNoteMentions";
import { useCreateInternalNote } from "@/hooks/useProjectInternalNotes";
import { MAX_MENTIONS_PER_NOTE } from "@/infra/repositories/internalNoteMentions.repository";
import {
  COMENTARIO_DIARIO_MAX,
  comentarioValido,
  corpoDoComentario,
  referenciaDoRelato,
  type ContextoDoRelato,
} from "@/lib/diarioObra/comentario";

interface Props {
  projectId: string | null;
  contexto: ContextoDoRelato | null;
  onClose: () => void;
}

export function DiarioComentarSheet({ projectId, contexto, onClose }: Props) {
  const { user } = useAuth();
  const [texto, setTexto] = useState("");
  const [marcados, setMarcados] = useState<MentionPerson[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);
  const criar = useCreateInternalNote();
  const marcar = useSetNoteMentions();
  const aberto = !!projectId && !!contexto;

  const fechar = () => {
    setTexto("");
    setMarcados([]);
    setEscolhendo(false);
    onClose();
  };

  const enviar = () => {
    if (!projectId || !contexto || !comentarioValido(texto) || criar.isPending) return;
    const userIds = marcados.map((m) => m.id);
    criar.mutate(
      { projectId, body: corpoDoComentario(contexto, texto), category: "outro" },
      {
        onSuccess: (nota) => {
          if (nota?.id && userIds.length > 0) marcar.mutate({ noteId: nota.id, userIds });
          else toast.success("Comentário registrado na obra");
          fechar();
        },
      },
    );
  };

  return (
    <>
      <Sheet open={aberto && !escolhendo} onOpenChange={(o) => !o && !escolhendo && fechar()}>
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col gap-3 rounded-t-3xl">
          <SheetHeader className="text-left">
            <SheetTitle className="text-lg font-bold">Comentar e marcar</SheetTitle>
            <SheetDescription>
              {contexto ? referenciaDoRelato(contexto) : ""}. Só a equipe vê. O cliente não.
            </SheetDescription>
          </SheetHeader>

          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={COMENTARIO_DIARIO_MAX}
            rows={4}
            placeholder="O que precisa ser feito?"
            aria-label="Comentário"
            className="min-h-[112px] text-base"
          />

          {marcados.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Pessoas marcadas">
              {marcados.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setMarcados((l) => l.filter((x) => x.id !== m.id))}
                    aria-label={`Tirar ${m.nome}`}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    @{m.nome}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start text-base"
            disabled={criar.isPending || marcados.length >= MAX_MENTIONS_PER_NOTE}
            onClick={() => setEscolhendo(true)}
          >
            <AtSign className="mr-2 h-4 w-4" aria-hidden="true" />
            Marcar alguém
          </Button>

          <Button
            type="button"
            className="h-14 text-base font-bold"
            disabled={!comentarioValido(texto) || criar.isPending}
            onClick={enviar}
          >
            {criar.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Enviando" /> : "Registrar"}
          </Button>
        </SheetContent>
      </Sheet>

      <MentionPicker
        open={aberto && escolhendo}
        onOpenChange={setEscolhendo}
        selectedIds={marcados.map((m) => m.id)}
        excludeId={user?.id ?? null}
        onPick={(p) => {
          setMarcados((l) => (l.some((x) => x.id === p.id) ? l : [...l, p]));
          setEscolhendo(false);
        }}
      />
    </>
  );
}
