/**
 * Card "Prazo contratual" — Fase 1 (somente equipe; EditarObra é StaffRoute).
 *
 * O escritório informa os termos do contrato (N dias úteis, gatilho, multa) e
 * vê a entrega calculada pelo banco com feriados, dias não úteis da obra e
 * aditivos aceitos. Obras preenchidas automaticamente a partir do cronograma
 * aparecem como "a conferir" até alguém marcar como conferido.
 */
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileSignature, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProjectDeadline, useUpdateContractTerms } from "@/hooks/useContractDeadline";
import type { ContractStartTrigger } from "@/infra/repositories/contractDeadline.repository";
import {
  DEADLINE_HEALTH_LABEL,
  START_TRIGGER_LABEL,
  deadlineHealth,
  parseDecimal,
  validateContractTerms,
} from "@/lib/contractDeadline";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  canEdit: boolean;
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy (EEE)", { locale: ptBR }) : "—";
const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toInput = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

const HEALTH_CLASS = {
  sem_prazo: "bg-muted text-muted-foreground",
  no_prazo: "bg-success/10 text-success border border-success/25",
  atencao: "bg-warning/10 text-warning border border-warning/30",
  atrasada: "bg-destructive/10 text-destructive border border-destructive/20",
} as const;

export function PrazoContratualCard({ projectId, canEdit }: Props) {
  const { toast } = useToast();
  const { data: d, isLoading } = useProjectDeadline(projectId);
  const update = useUpdateContractTerms(projectId);

  const [days, setDays] = useState("");
  const [trigger, setTrigger] = useState<ContractStartTrigger | "">("");
  const [startDate, setStartDate] = useState("");
  const [pct, setPct] = useState("");
  const [cap, setCap] = useState("");

  useEffect(() => {
    if (!d) return;
    setDays(d.contract_business_days == null ? "" : String(d.contract_business_days));
    setTrigger(d.contract_start_trigger ?? "");
    setStartDate(d.contract_start_date ?? "");
    setPct(toInput(d.penalty_pct_per_day));
    setCap(toInput(d.penalty_cap_pct));
  }, [d]);

  const save = (confirm: boolean) => {
    const terms = {
      contract_business_days: days.trim() === "" ? null : Number(days),
      contract_start_trigger: trigger === "" ? null : trigger,
      contract_start_date: startDate || null,
      penalty_pct_per_day: parseDecimal(pct),
      penalty_cap_pct: parseDecimal(cap),
    };
    const err = validateContractTerms(terms);
    if (err) {
      toast({ title: "Confira os dados do contrato", description: err, variant: "destructive" });
      return;
    }
    update.mutate(
      { ...terms, confirm },
      {
        onSuccess: () =>
          toast({ title: confirm ? "Prazo contratual conferido" : "Prazo contratual salvo" }),
        onError: (e) =>
          toast({
            title: "Não foi possível salvar",
            description: e instanceof Error ? e.message : undefined,
            variant: "destructive",
          }),
      },
    );
  };

  const health = deadlineHealth(d);
  const hasAmendments = (d?.amendment_business_days ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-body">
            <FileSignature className="h-5 w-5" />
            Prazo contratual
          </CardTitle>
          {!isLoading && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", HEALTH_CLASS[health])}>
              {DEADLINE_HEALTH_LABEL[health]}
            </span>
          )}
        </div>
        <CardDescription>
          Dias úteis firmados em contrato. Visível apenas para a equipe; o cliente continua vendo só o cronograma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {d && d.contract_business_days != null && !d.contract_terms_confirmed && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Preenchido automaticamente a partir do cronograma planejado. Confira com o contrato assinado e
              informe gatilho e multa.
            </p>
          </div>
        )}

        {/* Resumo calculado */}
        {d?.current_deadline && (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Entrega contratual</dt>
              <dd className="font-medium">{fmtDate(d.contract_deadline)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entrega vigente</dt>
              <dd className="font-medium">
                {fmtDate(d.current_deadline)}
                {hasAmendments && (
                  <span className="block text-xs text-muted-foreground">
                    +{d.amendment_business_days} dias úteis de aditivo
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dias úteis</dt>
              <dd className="font-medium">
                {d.business_days_elapsed} de {d.current_business_days} decorridos
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {(d.business_days_late ?? 0) > 0 ? "Atraso" : "Restam"}
              </dt>
              <dd className={cn("font-medium", (d.business_days_late ?? 0) > 0 && "text-destructive")}>
                {(d.business_days_late ?? 0) > 0
                  ? `${d.business_days_late} dias úteis`
                  : `${d.business_days_remaining} dias úteis`}
                {(d.penalty_accrued_value ?? 0) > 0 && (
                  <span className="block text-xs">Multa acumulada {fmtBRL(d.penalty_accrued_value)}</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        {(d?.amendments_pending ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            {d?.amendments_pending} aditivo(s) em rascunho ou aguardando o cliente; só contam depois de aceitos.
          </p>
        )}

        {/* Termos */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prazo-dias">Dias úteis do contrato</Label>
            <Input
              id="prazo-dias"
              inputMode="numeric"
              value={days}
              disabled={!canEdit}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex.: 60"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prazo-gatilho">Contagem começa em</Label>
            <Select
              value={trigger}
              disabled={!canEdit}
              onValueChange={(v) => setTrigger(v as ContractStartTrigger)}
            >
              <SelectTrigger id="prazo-gatilho">
                <SelectValue placeholder="Selecione o gatilho" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(START_TRIGGER_LABEL) as ContractStartTrigger[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {START_TRIGGER_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prazo-data">Data do gatilho</Label>
            <Input
              id="prazo-data"
              type="date"
              value={startDate}
              disabled={!canEdit}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prazo-multa">Multa por dia útil (%)</Label>
              <Input
                id="prazo-multa"
                inputMode="decimal"
                value={pct}
                disabled={!canEdit}
                onChange={(e) => setPct(e.target.value)}
                placeholder="Ex.: 0,5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo-teto">Teto da multa (%)</Label>
              <Input
                id="prazo-teto"
                inputMode="decimal"
                value={cap}
                disabled={!canEdit}
                onChange={(e) => setCap(e.target.value)}
                placeholder="Ex.: 10"
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {d?.contract_terms_confirmed && (
              <Badge variant="outline" className="mr-auto gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conferido com o contrato
              </Badge>
            )}
            <Button variant="outline" disabled={update.isPending} onClick={() => save(false)}>
              Salvar
            </Button>
            <Button disabled={update.isPending} onClick={() => save(true)}>
              Salvar e marcar como conferido
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
