/**
 * Gaveta da obra no Painel de Obras.
 *
 * O Painel é para olhar; o que o escritório precisa registrar fica aqui, fora
 * da linha: responsável, etapa, relacionamento com o cliente, "obra
 * paralisada" e as datas (entrega real incluída). A situação da obra (cor,
 * folga, multa) é só leitura — é calculada, nunca digitada.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ClipboardList, ExternalLink, FileSignature, GanttChartSquare } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/hojeDia";
import { ddmm, formatBRL, RISK_LABEL, slackLabel, type ObraRow } from "@/lib/obrasPainel";
import { resultadoLabel, staleLabel, type ConcluidaRow, type ProjetoRow } from "@/lib/painelNovo";
import {
  ETAPA_OPTIONS,
  RELACIONAMENTO_OPTIONS,
  type PainelEtapa,
  type PainelObra,
  type PainelObraPatch,
  type PainelRelacionamento,
} from "@/hooks/usePainelObras";
import { buildCoordenadorOptions, type StaffUser } from "@/hooks/useStaffUsers";
import { RISK_DOT, slackTone } from "@/components/gestao/obras/ObrasList";
import { FichaObraSheet } from "@/components/gestao/ficha/FichaObraSheet";

const NONE = "__none__";
const ddmmaa = (iso: string) => `${ddmm(iso)}/${iso.slice(2, 4)}`;

type DateField = "inicio_oficial" | "entrega_oficial" | "inicio_real" | "entrega_real";

const DATE_LABEL: Record<DateField, string> = {
  inicio_oficial: "Início previsto",
  entrega_oficial: "Entrega prevista",
  inicio_real: "Início real",
  entrega_real: "Entrega real",
};

const DATE_SAVED: Record<DateField, string> = {
  inicio_oficial: "Início previsto salvo",
  entrega_oficial: "Entrega prevista salva",
  inicio_real: "Início real salvo",
  entrega_real: "Entrega real salva",
};

const DATE_CLEARED: Record<DateField, string> = {
  inicio_oficial: "Início previsto removido",
  entrega_oficial: "Entrega prevista removida",
  inicio_real: "Início real removido",
  entrega_real: "Entrega real removida",
};

/** Datas que vêm do cronograma: mudar aqui pede confirmação. */
const FROM_SCHEDULE: ReadonlySet<DateField> = new Set(["inicio_oficial", "entrega_oficial"]);

export interface ObraDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cadastro da obra. null = obra não encontrada (ex.: endereço antigo). */
  obra: PainelObra | null;
  /** Linha calculada, quando a obra está em execução. */
  row?: ObraRow | null;
  projeto?: ProjetoRow | null;
  concluida?: ConcluidaRow | null;
  staff: readonly StaffUser[];
  canEdit: boolean;
  /** Grava no cadastro da obra. Rejeita em caso de erro (o aviso de erro já é dado por quem grava). */
  onPatch: (id: string, patch: PainelObraPatch) => Promise<unknown>;
  weekHref?: string;
}

/** Valida uma data digitada. Retorna a mensagem de erro, ou null se pode gravar. */
export function validateObraDate(
  field: DateField,
  value: string | null,
  obra: Pick<PainelObra, DateField>,
  today: string,
): string | null {
  if (value == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2000-01-01") return "Data inválida.";
  if ((field === "inicio_real" || field === "entrega_real") && value > today) {
    return `${DATE_LABEL[field]} não pode ser uma data futura.`;
  }
  if (field === "entrega_real" && obra.inicio_real && value < obra.inicio_real) {
    return "A entrega real não pode ser antes do início real.";
  }
  if (field === "inicio_real" && obra.entrega_real && value > obra.entrega_real) {
    return "O início real não pode ser depois da entrega real.";
  }
  if (field === "entrega_oficial" && obra.inicio_oficial && value < obra.inicio_oficial) {
    return "A entrega prevista não pode ser antes do início previsto.";
  }
  if (field === "inicio_oficial" && obra.entrega_oficial && value > obra.entrega_oficial) {
    return "O início previsto não pode ser depois da entrega prevista.";
  }
  return null;
}

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium tabular-nums text-foreground", tone)}>{children}</dd>
    </div>
  );
}

export function ObraDrawer({
  open,
  onOpenChange,
  obra: obraProp,
  row,
  projeto,
  concluida,
  staff,
  canEdit,
  onPatch,
  weekHref,
}: ObraDrawerProps) {
  // Enquanto a gaveta fecha, a obra já saiu da URL: mantém a última para o
  // conteúdo não virar "não encontrada" durante a animação.
  const lastObra = useRef(obraProp);
  if (obraProp) lastObra.current = obraProp;
  const obra = open ? obraProp : lastObra.current;

  const [dates, setDates] = useState<Record<DateField, string>>({
    inicio_oficial: "",
    entrega_oficial: "",
    inicio_real: "",
    entrega_real: "",
  });
  const [confirm, setConfirm] = useState<{ field: DateField; value: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  /** O diálogo fechou porque a pessoa confirmou (e não porque cancelou). */
  const confirmed = useRef(false);
  const [fichaOpen, setFichaOpen] = useState(false);

  // Os campos de data seguem o cadastro (inclusive depois de gravar ou de um erro).
  const obraId = obra?.id;
  const { inicio_oficial, entrega_oficial, inicio_real, entrega_real } = obra ?? {};
  useEffect(() => {
    setDates({
      inicio_oficial: inicio_oficial ?? "",
      entrega_oficial: entrega_oficial ?? "",
      inicio_real: inicio_real ?? "",
      entrega_real: entrega_real ?? "",
    });
  }, [obraId, inicio_oficial, entrega_oficial, inicio_real, entrega_real, open]);

  // A ficha fecha junto com a gaveta e não reabre sozinha em outra obra.
  useEffect(() => {
    setFichaOpen(false);
  }, [open, obraId]);

  if (!obra) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle>Obra não encontrada</SheetTitle>
            <SheetDescription>Ela pode ter sido excluída ou você não tem acesso a ela.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const save = async (patch: PainelObraPatch, ok: string) => {
    setSaving(true);
    try {
      // O id vem da obra que está na gaveta, não do endereço: durante o
      // fechamento o endereço já não tem a obra.
      await onPatch(obra.id, patch);
      toast.success(ok);
    } catch {
      // O aviso de erro vem de quem grava; aqui só não deixamos a promessa solta.
    } finally {
      setSaving(false);
    }
  };

  const resetDate = (field: DateField) => setDates((d) => ({ ...d, [field]: obra[field] ?? "" }));

  const commitDate = (field: DateField) => {
    const value = dates[field] === "" ? null : dates[field];
    if (value === (obra[field] ?? null)) return;
    const error = validateObraDate(field, value, obra, todayISO());
    if (error) {
      toast.error(error);
      resetDate(field);
      return;
    }
    if (FROM_SCHEDULE.has(field) && obra[field]) {
      setConfirm({ field, value });
      return;
    }
    void save({ [field]: value } as PainelObraPatch, value ? DATE_SAVED[field] : DATE_CLEARED[field]);
  };

  const responsavelOptions = buildCoordenadorOptions([...staff], obra.responsavel_id);
  const disabled = !canEdit || saving;
  const emExecucao = !!row;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full space-y-6 overflow-y-auto sm:max-w-md">
          <SheetHeader className="space-y-1 pr-6 text-left">
            <SheetDescription>{obra.customer_name ?? "Obra"}</SheetDescription>
            <SheetTitle className="text-lg leading-snug">{obra.nome}</SheetTitle>
            <p className="flex items-center gap-2 pt-1 text-sm text-foreground">
              {row ? (
                <>
                  <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", RISK_DOT[row.risk])} />
                  {RISK_LABEL[row.risk]}
                </>
              ) : concluida ? (
                "Obra concluída"
              ) : projeto ? (
                "Em fase de projeto"
              ) : (
                "Fora da lista em execução"
              )}
            </p>
          </SheetHeader>

          {/* Situação: só leitura, calculada */}
          {row && (
            <section aria-label="Situação da obra" className="space-y-3">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <Fact label="Entrega do contrato">{row.deadline ? ddmmaa(row.deadline) : "Não cadastrada"}</Fact>
                <Fact label="Folga" tone={slackTone(row.slack)}>
                  {row.slack == null ? "—" : `${slackLabel(row.slack)} úteis`}
                </Fact>
                <Fact label="Término projetado">{row.projectedEnd ? ddmmaa(row.projectedEnd) : "Sem cronograma"}</Fact>
                <Fact label="Multa se nada mudar" tone={row.penalty ? "text-destructive" : undefined}>
                  {row.penalty == null ? "—" : formatBRL(row.penalty)}
                </Fact>
              </dl>
              {row.alerts.some((a) => a.kind !== "multa") && (
                <ul className="space-y-1 text-sm">
                  {row.alerts.filter((a) => a.kind !== "multa").map((a) => (
                    <li
                      key={a.kind}
                      className={cn(
                        a.tone === "destructive" && "font-medium text-destructive",
                        a.tone === "warning" && "font-medium text-warning",
                        a.tone === "muted" && "text-muted-foreground",
                      )}
                    >
                      {a.text}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {concluida && (
            <section aria-label="Resultado da obra">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <Fact label="Entrega do contrato">{concluida.deadline ? ddmmaa(concluida.deadline) : "Não cadastrada"}</Fact>
                <Fact label="Entregue em">{concluida.deliveredOn ? ddmmaa(concluida.deliveredOn) : "—"}</Fact>
                <Fact
                  label="Resultado"
                  tone={concluida.resultado === "atrasada" ? "text-destructive" : concluida.resultado === "no_prazo" ? "text-success" : undefined}
                >
                  {resultadoLabel(concluida)}
                </Fact>
                <Fact label="Multa" tone={concluida.penalty ? "text-destructive" : undefined}>
                  {concluida.penalty ? formatBRL(concluida.penalty) : "—"}
                </Fact>
              </dl>
            </section>
          )}
          {projeto && !row && !concluida && (
            <section aria-label="Situação do projeto">
              <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <Fact label="Última atualização">{staleLabel(projeto.staleDays)}</Fact>
                <Fact label="Na etapa atual">
                  {projeto.daysInEtapa == null ? "—" : `${projeto.daysInEtapa} ${projeto.daysInEtapa === 1 ? "dia" : "dias"}`}
                </Fact>
              </dl>
            </section>
          )}

          {/* Atalhos */}
          <nav aria-label="Atalhos da obra" className="grid grid-cols-2 gap-2">
            {emExecucao && weekHref && (
              <Button asChild className="col-span-2 min-h-[44px]">
                <Link to={weekHref}>
                  <CalendarRange className="h-4 w-4" aria-hidden="true" />
                  Planejar a semana
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to={`/obra/${obra.id}`}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir obra
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to={`/obra/${obra.id}/cronograma`}>
                <GanttChartSquare className="h-4 w-4" aria-hidden="true" />
                Cronograma
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="col-span-2 min-h-[44px]"
              onClick={() => setFichaOpen(true)}
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Ficha da obra
            </Button>
            <Button asChild variant="ghost" className="col-span-2 min-h-[44px] justify-start text-muted-foreground">
              <Link to={`/gestao/obra/${obra.id}`}>
                <FileSignature className="h-4 w-4" aria-hidden="true" />
                Cadastro e prazo do contrato
              </Link>
            </Button>
          </nav>

          {/* Cadastro digitado */}
          <section aria-label="Cadastro da obra" className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Cadastro</h3>

            <div className="space-y-1.5">
              <Label htmlFor="obra-responsavel">Responsável</Label>
              <Select
                value={obra.responsavel_id ?? NONE}
                disabled={disabled}
                onValueChange={(v) =>
                  void save({ responsavel_id: v === NONE ? null : v }, v === NONE ? "Responsável removido" : "Responsável salvo")
                }
              >
                <SelectTrigger id="obra-responsavel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {responsavelOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obra-etapa">Etapa</Label>
              <Select
                value={obra.etapa ?? NONE}
                disabled={disabled}
                onValueChange={(v) => void save({ etapa: v === NONE ? null : (v as PainelEtapa) }, "Etapa salva")}
              >
                <SelectTrigger id="obra-etapa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem etapa</SelectItem>
                  {ETAPA_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {obra.etapa === "Finalizada" && !obra.entrega_real && (
                <p className="text-xs text-warning">
                  Etapa finalizada sem entrega real. Informe a data abaixo para a obra sair da lista em execução.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obra-relacionamento">Relacionamento com o cliente</Label>
              <Select
                value={obra.relacionamento ?? NONE}
                disabled={disabled}
                onValueChange={(v) =>
                  void save({ relacionamento: v === NONE ? null : (v as PainelRelacionamento) }, "Relacionamento salvo")
                }
              >
                <SelectTrigger id="obra-relacionamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não informado</SelectItem>
                  {RELACIONAMENTO_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="obra-paralisada">Obra paralisada</Label>
                <p id="obra-paralisada-ajuda" className="text-xs text-muted-foreground">
                  Marque quando a obra está parada. A cor da situação continua sendo calculada pelo prazo e pelo cronograma.
                </p>
                {row?.cadastro?.paused && obra.status !== "Paralisada" && (
                  <p className="mt-1 text-xs text-warning">
                    Esta obra está com o status "Pausada" no cadastro. Para retomar, mude o status em "Cadastro e prazo do
                    contrato".
                  </p>
                )}
              </div>
              <Switch
                id="obra-paralisada"
                checked={obra.status === "Paralisada"}
                aria-describedby="obra-paralisada-ajuda"
                disabled={disabled}
                onCheckedChange={(on) =>
                  void save({ status: on ? "Paralisada" : null }, on ? "Obra marcada como paralisada" : "Obra retomada")
                }
              />
            </div>
          </section>

          <section aria-label="Datas da obra" className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Datas</h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(DATE_LABEL) as DateField[]).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`obra-${field}`}>{DATE_LABEL[field]}</Label>
                  <Input
                    id={`obra-${field}`}
                    type="date"
                    value={dates[field]}
                    // Só a permissão desabilita: travar durante a gravação
                    // derrubaria o foco de quem passa de um campo ao outro.
                    disabled={!canEdit}
                    max={field === "inicio_real" || field === "entrega_real" ? todayISO() : undefined}
                    onChange={(e) => setDates((d) => ({ ...d, [field]: e.target.value }))}
                    onBlur={() => commitDate(field)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitDate(field);
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Início e entrega previstos vêm do cronograma. Com a entrega real preenchida, a obra passa para Concluídas.
            </p>
            {!canEdit && <p className="text-xs text-muted-foreground">Você não tem permissão para alterar o cadastro desta obra.</p>}
          </section>
        </SheetContent>
      </Sheet>

      {/* Endereço, chaves, senha, condomínio e contatos do prédio. */}
      <FichaObraSheet open={fichaOpen && open} onOpenChange={setFichaOpen} projectId={obra.id} projectName={obra.nome} />

      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (o) return;
          // Fechou sem confirmar (Cancelar, Esc): o campo volta ao valor gravado.
          if (confirm && !confirmed.current) resetDate(confirm.field);
          confirmed.current = false;
          setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar {confirm ? DATE_LABEL[confirm.field].toLowerCase() : "a data"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta data vem do cronograma da obra. Mudar aqui não move as etapas, e ela volta a seguir o cronograma na próxima
              vez que ele for salvo. O prazo do contrato não muda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                const { field, value } = confirm;
                confirmed.current = true;
                void save({ [field]: value } as PainelObraPatch, value ? DATE_SAVED[field] : DATE_CLEARED[field]);
              }}
            >
              Alterar a data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
