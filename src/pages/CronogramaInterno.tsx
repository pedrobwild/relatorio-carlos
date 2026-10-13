/**
 * Cronograma interno da obra — ferramenta de trabalho da equipe (staff-only).
 *
 * Nasce como cópia do cronograma do cliente e depois evolui sozinho: datas
 * puxadas, micro-etapas, responsável e prestador. O cliente nunca vê esta
 * tela nem estes dados; o cronograma do cliente continua em "Cronograma do
 * cliente" e não muda por nada que se faça aqui.
 *
 * A Semana / Hoje penduram as atividades nestes itens, e o Painel projeta o
 * término a partir deles.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CopyPlus, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useCan } from "@/hooks/useCan";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { useFornecedoresPrestadores } from "@/hooks/useFornecedoresPrestadores";
import {
  internalScheduleErrorMessage,
  useInternalSchedule,
  useInternalScheduleMutations,
  useInternalScheduleOpsRefs,
} from "@/hooks/useInternalSchedule";
import type {
  InternalScheduleItemWithRefs,
  InternalSchedulePatch,
} from "@/infra/repositories/internalSchedule.repository";
import {
  buildTree,
  daysLabel,
  ddmm,
  deliverySummary,
  groupByEtapa,
  moveWithinSiblings,
  nextSortOrder,
  type ClientDatesLike,
  type DeliverySummary,
} from "@/lib/internalSchedule";
import { todayISO } from "@/lib/hojeDia";
import { cn } from "@/lib/utils";
import { InternalScheduleRow } from "@/components/cronograma-interno/InternalScheduleRow";
import {
  InternalItemSheet,
  type InternalItemValues,
  type SheetMode,
} from "@/components/cronograma-interno/InternalItemSheet";

function DeliveryChip({ summary }: { summary: DeliverySummary }) {
  if (!summary.status) return null;
  if (summary.status === "igual") {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Mesma entrega do cliente
      </Badge>
    );
  }
  if (summary.status === "risco") {
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 font-medium text-destructive">
        Risco: termina {daysLabel(summary.days)} depois do cliente
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/40 bg-success/10 font-medium text-success">
      Folga: termina {daysLabel(summary.days)} antes do cliente
    </Badge>
  );
}

export default function CronogramaInterno() {
  const { projectId, paths } = useProjectNavigation();
  const { can } = useCan();
  const canEdit = can("internalSchedule:edit");
  const { items, clientActivities, clientLoaded, isLoading, error, refetch } = useInternalSchedule(projectId);
  const { create, update, remove, reorder, copyFromClient } = useInternalScheduleMutations(projectId);
  const { data: staff = [] } = useStaffUsers();
  const { data: prestadores = [] } = useFornecedoresPrestadores();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);
  const [toDelete, setToDelete] = useState<InternalScheduleItemWithRefs | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const tree = useMemo(() => buildTree(items), [items]);
  const groups = useMemo(() => groupByEtapa(tree), [tree]);
  const clientById = useMemo(
    () => new Map<string, ClientDatesLike>(clientActivities.map((a) => [a.id, a])),
    [clientActivities],
  );
  const summary = useMemo(() => deliverySummary(items, clientActivities), [items, clientActivities]);
  const etapas = useMemo(
    () => [...new Set(items.map((i) => i.etapa?.trim()).filter((e): e is string => !!e))],
    [items],
  );

  // Aviso ao excluir: atividades da Semana penduradas no item ou nas micro-etapas dele.
  const deleteIds = useMemo(
    () => (toDelete ? [toDelete.id, ...items.filter((i) => i.parent_id === toDelete.id).map((i) => i.id)] : []),
    [toDelete, items],
  );
  const opsRefs = useInternalScheduleOpsRefs(deleteIds, !!toDelete);
  const childCount = deleteIds.length > 0 ? deleteIds.length - 1 : 0;

  const patch = (id: string, p: InternalSchedulePatch, ok?: string) => {
    update.mutate({ id, patch: p }, { onSuccess: () => ok && toast.success(ok) });
  };

  const move = (siblings: readonly InternalScheduleItemWithRefs[]) => (id: string, direction: "up" | "down") => {
    const changes = moveWithinSiblings(siblings, id, direction);
    if (changes.length > 0) reorder.mutate(changes);
  };

  const openEdit = (item: InternalScheduleItemWithRefs) => {
    setSheetMode({ kind: "edit", item });
    setSheetOpen(true);
  };
  const openCreate = (parent: InternalScheduleItemWithRefs | null) => {
    const today = todayISO();
    setSheetMode({
      kind: "create",
      parent,
      defaults: parent
        ? {
            etapa: parent.etapa ?? "",
            planned_start: parent.planned_start,
            planned_end: parent.planned_end,
            responsible_user_id: parent.responsible_user_id,
            fornecedor_id: parent.fornecedor_id,
          }
        : { planned_start: today, planned_end: today },
    });
    setSheetOpen(true);
  };

  const submitSheet = async (values: InternalItemValues) => {
    if (!sheetMode) return;
    try {
      if (sheetMode.kind === "edit") {
        await update.mutateAsync({ id: sheetMode.item.id, patch: values });
        toast.success("Item salvo");
      } else {
        await create.mutateAsync({
          ...values,
          parent_id: sheetMode.parent?.id ?? null,
          sort_order: nextSortOrder(items),
        });
        toast.success(sheetMode.parent ? "Micro-etapa adicionada" : "Item adicionado");
      }
      setSheetOpen(false);
    } catch {
      // O aviso de erro já foi dado pela mutação; a gaveta fica aberta.
    }
  };

  const header = (
    <div className="space-y-1">
      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Cronograma interno</h1>
      <p className="text-sm text-muted-foreground">
        Ferramenta de trabalho da equipe. O cliente não vê — o que ele vê continua no{" "}
        <Link to={paths.cronograma} className="font-medium text-foreground underline underline-offset-2">
          cronograma do cliente
        </Link>
        .
      </p>
    </div>
  );

  // A rota já é StaffRoute; isto é a mesma regra na matriz de permissões.
  if (!can("internalSchedule:view")) {
    return (
      <PageContainer maxWidth="xl" className="space-y-4 py-4">
        {header}
        <p role="alert" className="text-sm text-muted-foreground">
          Você não tem acesso ao cronograma interno desta obra.
        </p>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" className="space-y-4 py-4">
        {header}
        <div className="space-y-3" aria-busy="true" aria-label="Carregando cronograma interno">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" className="space-y-4 py-4">
        {header}
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">{internalScheduleErrorMessage(error)}</p>
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      </PageContainer>
    );
  }

  const empty = items.length === 0;

  return (
    <PageContainer maxWidth="xl" className="space-y-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {header}
        {canEdit && !empty && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-[44px] gap-1.5" onClick={() => openCreate(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar item
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-1.5"
              onClick={() => setConfirmReplace(true)}
              disabled={copyFromClient.isPending}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Copiar de novo do cronograma do cliente
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Somente leitura: seu perfil pode ver o cronograma interno, mas não alterar.
        </p>
      )}

      {/* Entrega interna × cliente */}
      {(summary.internalEnd || summary.clientEnd) && (
        <section
          aria-label="Entrega interna e do cliente"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3"
        >
          <p className="text-sm tabular-nums text-foreground">
            <span className="text-muted-foreground">Entrega interna</span>{" "}
            <strong>{summary.internalEnd ? ddmm(summary.internalEnd) : "—"}</strong>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Cliente</span>{" "}
            <strong>{summary.clientEnd ? ddmm(summary.clientEnd) : clientLoaded ? "sem cronograma" : "—"}</strong>
          </p>
          <DeliveryChip summary={summary} />
        </section>
      )}

      {empty ? (
        <section className="space-y-3 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-base font-semibold text-foreground">Esta obra ainda não tem cronograma interno</p>
          <p className="text-sm text-muted-foreground">
            {clientActivities.length > 0
              ? `Comece copiando o cronograma do cliente (${clientActivities.length} ${clientActivities.length === 1 ? "atividade" : "atividades"}). Depois disso, o que mudar aqui não muda o do cliente.`
              : "O cronograma do cliente também está vazio. Você pode montar o interno do zero."}
          </p>
          {canEdit && (
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              {clientActivities.length > 0 && (
                <Button
                  type="button"
                  className="min-h-[44px] gap-1.5"
                  onClick={() => copyFromClient.mutate(false)}
                  disabled={copyFromClient.isPending}
                >
                  {copyFromClient.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CopyPlus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Copiar do cronograma do cliente
                </Button>
              )}
              <Button type="button" variant="outline" className="min-h-[44px] gap-1.5" onClick={() => openCreate(null)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar item
              </Button>
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const roots = g.nodes.map((n) => n.item);
            return (
              <section key={g.etapa ?? "__sem_etapa__"} aria-label={g.etapa ?? "Itens"} className="space-y-2">
                {(g.etapa || groups.length > 1) && (
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.etapa ?? "Sem etapa"}
                  </h2>
                )}
                <ul className="space-y-2">
                  {g.nodes.map((node, idx) => (
                    <li key={node.item.id} className="space-y-2">
                      <ul className="space-y-2">
                        <InternalScheduleRow
                          item={node.item}
                          clientById={clientById}
                          clientLoaded={clientLoaded}
                          canEdit={canEdit}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < roots.length - 1}
                          onPatch={patch}
                          onMove={move(roots)}
                          onOpen={openEdit}
                          onAddChild={(it) => openCreate(it)}
                          onDelete={setToDelete}
                        />
                        {node.children.map((child, cIdx) => (
                          <InternalScheduleRow
                            key={child.id}
                            item={child}
                            isChild
                            clientById={clientById}
                            clientLoaded={clientLoaded}
                            canEdit={canEdit}
                            canMoveUp={cIdx > 0}
                            canMoveDown={cIdx < node.children.length - 1}
                            onPatch={patch}
                            onMove={move(node.children)}
                            onOpen={openEdit}
                            onDelete={setToDelete}
                          />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <InternalItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        items={items}
        staff={staff}
        prestadores={prestadores}
        etapas={etapas}
        canEdit={canEdit}
        saving={create.isPending || update.isPending}
        onSubmit={submitSheet}
      />

      {/* Excluir item */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.description}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Sai só do cronograma interno. O cronograma do cliente não muda.</p>
                {childCount > 0 && (
                  <p>
                    {childCount === 1 ? "A micro-etapa dele também será excluída." : `As ${childCount} micro-etapas dele também serão excluídas.`}
                  </p>
                )}
                {opsRefs.isLoading ? (
                  <p>Verificando atividades da Semana ligadas a este item…</p>
                ) : (opsRefs.data ?? 0) > 0 ? (
                  <p className="font-medium text-warning" role="status">
                    {opsRefs.data === 1
                      ? "1 atividade da Semana está ligada a este item e vai ficar sem etapa."
                      : `${opsRefs.data} atividades da Semana estão ligadas a este item e vão ficar sem etapa.`}
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={() => {
                if (!toDelete) return;
                const id = toDelete.id;
                remove.mutate(id, { onSuccess: () => toast.success("Item excluído") });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copiar de novo do cliente (substitui) */}
      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir o cronograma interno?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O cronograma interno atual ({items.length} {items.length === 1 ? "item" : "itens"}) será apagado e
                  trocado por uma cópia nova do cronograma do cliente ({clientActivities.length}{" "}
                  {clientActivities.length === 1 ? "atividade" : "atividades"}).
                </p>
                <p>
                  Datas, micro-etapas, responsáveis e observações feitos aqui se perdem. As atividades da Semana passam
                  para o item novo da mesma atividade do cliente; as que estavam em itens só internos ficam sem etapa.
                </p>
                {clientLoaded && clientActivities.length === 0 && (
                  <p className="font-medium text-warning">O cronograma do cliente está vazio: nada será substituído.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => copyFromClient.mutate(true)}>Substituir pelo do cliente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
