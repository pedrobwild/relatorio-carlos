/**
 * "Algum desses atrasos não foi nosso?" — aditivo de prazo em 2 toques, dentro
 * do fechamento da semana (Fase 6).
 *
 * Os "Não feito" da semana aparecem agrupados pelo motivo. "Não foi nosso"
 * abre o rascunho já preenchido (motivo, dias úteis, descrição e as fotos do
 * dia); "Registrar rascunho" grava. O escritório confere, envia ao cliente e
 * marca como aceito na ficha da obra — só o aceito conta no prazo.
 */
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoCaptureButton, type CapturedPhoto } from "@/components/ui-premium/PhotoCaptureButton";
import { useContractAmendments, useCreateAmendmentDraft } from "@/hooks/useContractDeadline";
import { OPS_REASON_LABEL } from "@/lib/opsLabels";
import { ddmmOf } from "@/lib/semanaFechamento";
import {
  AMENDMENT_REASON_LABEL,
  AMENDMENT_STATUS_LABEL,
  MAX_AMENDMENT_DAYS,
  amendmentCandidates,
  amendmentDescription,
  amendmentsInWeek,
  clampAmendmentDays,
  type AmendmentCandidate,
  type AmendmentReason,
} from "@/lib/semanaAditivo";
import type { OpsAssignment } from "@/infra/repositories/ops.repository";

const REASONS = Object.keys(AMENDMENT_REASON_LABEL) as AmendmentReason[];

interface Props {
  projectId: string;
  monday: string;
  notDoneItems: ReadonlyArray<OpsAssignment>;
  titleOf: (activityId: string) => string;
}

export function WeekAmendmentsSection({ projectId, monday, notDoneItems, titleOf }: Props) {
  const { data: amendments = [] } = useContractAmendments(projectId);
  const candidates = useMemo(() => amendmentCandidates(notDoneItems, titleOf), [notDoneItems, titleOf]);
  const registered = useMemo(() => amendmentsInWeek(amendments, monday), [amendments, monday]);

  if (candidates.length === 0 && registered.length === 0) return null;

  return (
    <section aria-labelledby="fechar-aditivo" className="space-y-3">
      <div>
        <h3 id="fechar-aditivo" className="text-sm font-semibold text-foreground">
          Algum desses atrasos não foi nosso?
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Se o dia parou por causa do cliente, do condomínio ou do clima, registre aqui. Vira um rascunho de aditivo
          de prazo; o escritório confere e envia ao cliente.
        </p>
      </div>

      {registered.length > 0 && (
        <ul aria-label="Aditivos desta semana" className="space-y-1.5">
          {registered.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              <span className="font-medium">
                {AMENDMENT_REASON_LABEL[a.reason]} · +{a.business_days_added}{" "}
                {a.business_days_added === 1 ? "dia útil" : "dias úteis"}
              </span>
              <span className="text-muted-foreground"> · {AMENDMENT_STATUS_LABEL[a.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 && (
        <ul className="space-y-2">
          {candidates.map((c) => (
            <CandidateCard
              key={c.opsReason}
              projectId={projectId}
              monday={monday}
              candidate={c}
              alreadyRegistered={registered.some((a) => a.reason === c.reason)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CandidateCard({
  projectId,
  monday,
  candidate: c,
  alreadyRegistered,
}: {
  projectId: string;
  monday: string;
  candidate: AmendmentCandidate;
  alreadyRegistered: boolean;
}) {
  const create = useCreateAmendmentDraft();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AmendmentReason>(c.reason);
  const [days, setDays] = useState(c.days);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  // A prévia da foto é um object URL: solta ao trocar ou sair.
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  const reset = () => {
    setOpen(false);
    setReason(c.reason);
    setDays(c.days);
    setPhoto(null);
  };

  const register = async () => {
    try {
      const saved = await create.mutateAsync({
        project_id: projectId,
        reason,
        business_days_added: clampAmendmentDays(days),
        description: amendmentDescription(c, monday),
        event_date: c.firstDate,
        evidence_urls: c.photoPaths,
        photo: photo?.file ?? null,
      });
      const n = saved.business_days_added;
      toast.success(`Rascunho de aditivo registrado: +${n} ${n === 1 ? "dia útil" : "dias úteis"}`, {
        description: "O escritório confere e envia ao cliente. Só conta no prazo depois de aceito.",
      });
      reset();
    } catch {
      toast.error("Não foi possível registrar o aditivo. Tente de novo.");
    }
  };

  const daysText = c.days === 1 ? "1 dia" : `${c.days} dias`;
  const photosText =
    c.photoPaths.length === 0
      ? "Nenhuma foto nesses dias."
      : c.photoPaths.length === 1
        ? "A foto do dia entra como evidência."
        : `As ${c.photoPaths.length} fotos desses dias entram como evidência.`;

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {OPS_REASON_LABEL[c.opsReason]} · {daysText}
          </p>
          <p className="text-xs text-muted-foreground">
            {c.dates.map(ddmmOf).join(", ")} · {c.activityTitles.join(", ")}
          </p>
        </div>
        {alreadyRegistered ? (
          <span className="text-xs font-medium text-muted-foreground">Já registrado nesta semana</span>
        ) : (
          !open && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              aria-label={`Não foi nosso: ${OPS_REASON_LABEL[c.opsReason]}`}
              onClick={() => setOpen(true)}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Não foi nosso
            </Button>
          )
        )}
      </div>

      {open && !alreadyRegistered && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`aditivo-motivo-${c.opsReason}`}>Motivo do aditivo</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as AmendmentReason)}>
                <SelectTrigger id={`aditivo-motivo-${c.opsReason}`} className="min-h-[40px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {AMENDMENT_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label id={`aditivo-dias-${c.opsReason}`}>Dias úteis a pedir</Label>
              <div role="group" aria-labelledby={`aditivo-dias-${c.opsReason}`} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  aria-label="Menos um dia"
                  disabled={days <= 1}
                  onClick={() => setDays((d) => clampAmendmentDays(d - 1))}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="min-w-[2ch] text-center text-lg font-semibold tabular-nums text-foreground" aria-live="polite">
                  {days}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  aria-label="Mais um dia"
                  disabled={days >= MAX_AMENDMENT_DAYS}
                  onClick={() => setDays((d) => clampAmendmentDays(d + 1))}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{amendmentDescription(c, monday)}</p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{photosText}</span>
            {photo ? (
              <span className="inline-flex items-center gap-2">
                <img src={photo.previewUrl} alt="Foto nova da evidência" className="h-10 w-10 rounded object-cover" />
                <Button type="button" variant="ghost" size="sm" className="min-h-[40px]" onClick={() => setPhoto(null)}>
                  Tirar foto nova
                </Button>
              </span>
            ) : (
              <PhotoCaptureButton
                label="Adicionar foto"
                disabled={create.isPending}
                onCapture={(photos) => {
                  const [first, ...rest] = photos;
                  for (const p of rest) URL.revokeObjectURL(p.previewUrl);
                  if (first) setPhoto(first);
                }}
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-[44px] flex-1" disabled={create.isPending} onClick={reset}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-[44px] flex-1" disabled={create.isPending} onClick={register}>
              {create.isPending ? "Registrando…" : "Registrar rascunho"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
