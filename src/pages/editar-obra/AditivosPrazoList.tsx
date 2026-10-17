/**
 * Aditivos de prazo da obra, para o escritório (Fase 6; EditarObra é StaffRoute).
 *
 * O gestor registra o rascunho no fechamento da semana ("Algum desses atrasos
 * não foi nosso?"). Aqui o escritório confere, marca como enviado ao cliente
 * e registra a resposta. Só o ACEITO soma dias ao prazo (v_project_deadlines)
 * e passa a ser visível ao cliente (RLS de contract_term_amendments).
 */
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useContractAmendments,
  useDeleteAmendmentDraft,
  useUpdateAmendmentStatus,
} from "@/hooks/useContractDeadline";
import { useOpsPhotoUrls } from "@/hooks/useOps";
import {
  AMENDMENT_NEXT_STATUS,
  AMENDMENT_REASON_LABEL,
  AMENDMENT_STATUS_LABEL,
  type AmendmentStatus,
} from "@/lib/semanaAditivo";
import type { ContractAmendment } from "@/infra/repositories/contractDeadline.repository";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<AmendmentStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-warning/10 text-warning border border-warning/30",
  aceito: "bg-success/10 text-success border border-success/25",
  contestado: "bg-destructive/10 text-destructive border border-destructive/20",
};

const ACTION_LABEL: Record<AmendmentStatus, string> = {
  rascunho: "Voltar para rascunho",
  enviado: "Marcar como enviado ao cliente",
  aceito: "Cliente aceitou",
  contestado: "Cliente contestou",
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function AditivosPrazoList({ projectId, canEdit }: Props) {
  const { data: amendments = [], isLoading, isError } = useContractAmendments(projectId);

  return (
    <div className="space-y-2" aria-labelledby="aditivos-prazo-titulo" role="region">
      <h3 id="aditivos-prazo-titulo" className="text-sm font-semibold text-foreground">
        Aditivos de prazo
      </h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando aditivos…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os aditivos.</p>
      ) : amendments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum aditivo. O gestor registra no fechamento da semana, em “Algum desses atrasos não foi nosso?”.
        </p>
      ) : (
        <ul className="space-y-2">
          {amendments.map((a) => (
            <AmendmentRow key={a.id} amendment={a} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AmendmentRow({ amendment: a, canEdit }: { amendment: ContractAmendment; canEdit: boolean }) {
  const { toast } = useToast();
  const update = useUpdateAmendmentStatus();
  const remove = useDeleteAmendmentDraft();
  const [confirming, setConfirming] = useState<AmendmentStatus | "apagar" | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const busy = update.isPending || remove.isPending;
  const evidence = a.evidence_urls ?? [];

  const setStatus = (status: AmendmentStatus) =>
    update.mutate(
      { id: a.id, status },
      {
        onSuccess: () => {
          setConfirming(null);
          toast({
            title: AMENDMENT_STATUS_LABEL[status],
            description: status === "aceito" ? "Os dias passam a contar no prazo da obra." : undefined,
          });
        },
        onError: () => toast({ title: "Não foi possível atualizar o aditivo", variant: "destructive" }),
      },
    );

  const del = () =>
    remove.mutate(a.id, {
      onSuccess: () => {
        setConfirming(null);
        toast({ title: "Rascunho apagado" });
      },
      onError: () => toast({ title: "Não foi possível apagar o rascunho", variant: "destructive" }),
    });

  // Aceitar mexe no prazo e mostra o aditivo ao cliente: pede confirmação.
  const needsConfirm = (s: AmendmentStatus) => s === "aceito";

  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">
          {AMENDMENT_REASON_LABEL[a.reason]} · +{a.business_days_added}{" "}
          {a.business_days_added === 1 ? "dia útil" : "dias úteis"}
        </span>
        <Badge variant="outline" className={cn("font-medium", STATUS_CLASS[a.status])}>
          {AMENDMENT_STATUS_LABEL[a.status]}
        </Badge>
        <span className="text-xs text-muted-foreground">{format(parseISO(a.event_date), "dd/MM/yyyy")}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{a.description}</p>

      {evidence.length > 0 && (
        <div className="mt-1">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            aria-expanded={showPhotos}
            onClick={() => setShowPhotos((v) => !v)}
          >
            {showPhotos ? "Esconder fotos" : evidence.length === 1 ? "Ver 1 foto" : `Ver ${evidence.length} fotos`}
          </Button>
          {showPhotos && <EvidencePhotos paths={evidence} />}
        </div>
      )}

      {canEdit && (AMENDMENT_NEXT_STATUS[a.status].length > 0 || a.status === "rascunho") && (
        <div className="mt-2 flex flex-wrap gap-2">
          {confirming ? (
            <>
              <span className="self-center text-xs text-foreground">
                {confirming === "apagar"
                  ? "Apagar este rascunho?"
                  : "Confirmar que o cliente aceitou? Os dias passam a contar no prazo e o cliente vê o aditivo."}
              </span>
              <Button
                type="button"
                size="sm"
                variant={confirming === "apagar" ? "destructive" : "default"}
                disabled={busy}
                onClick={() => (confirming === "apagar" ? del() : setStatus(confirming))}
              >
                Confirmar
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              {AMENDMENT_NEXT_STATUS[a.status].map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => (needsConfirm(s) ? setConfirming(s) : setStatus(s))}
                >
                  {a.status === "contestado" && s === "enviado" ? "Enviar de novo" : ACTION_LABEL[s]}
                </Button>
              ))}
              {a.status === "rascunho" && (
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming("apagar")}>
                  Apagar rascunho
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function EvidencePhotos({ paths }: { paths: string[] }) {
  const { data: urls = [], isLoading, isError } = useOpsPhotoUrls(paths);
  if (isLoading) return <p className="mt-1 text-xs text-muted-foreground">Carregando fotos…</p>;
  if (isError || urls.length === 0)
    return <p className="mt-1 text-xs text-muted-foreground">Não foi possível abrir as fotos.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <a key={u.path} href={u.url} target="_blank" rel="noopener noreferrer">
          <img src={u.url} alt={`Evidência ${i + 1}`} className="h-16 w-16 rounded object-cover" />
        </a>
      ))}
    </div>
  );
}
