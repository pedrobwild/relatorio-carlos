import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { purchasesRepo, type ProjectBudgetItem } from "@/infra/repositories";
import { queryKeys } from "@/lib/queryKeys";
import { isAboveBudget, similarityScore } from "@/lib/schedule/weeklyPurchases";
import { cn } from "@/lib/utils";

const brl = (v: number | null | undefined) =>
  v == null ? "Sem valor" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useProjectBudgetItems(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchases.budgetItems(projectId),
    enabled: !!projectId && enabled,
    queryFn: async () => {
      const res = await purchasesRepo.listProjectBudgetItems(projectId!);
      if (res.error) throw res.error;
      return res.data ?? [];
    },
  });
}

/** "Orçado: R$ X" e destaque "acima do orçado" quando o custo real passa. */
export function BudgetedAmount({
  projectId,
  orcamentoItemId,
  actualCost,
}: {
  projectId: string;
  orcamentoItemId: string | null | undefined;
  actualCost: number | null | undefined;
}) {
  const { data } = useProjectBudgetItems(projectId, !!orcamentoItemId);
  if (!orcamentoItemId) return null;
  const item = data?.find((i) => i.id === orcamentoItemId);
  if (!item) return null;
  const above = isAboveBudget(actualCost, item.total);
  return (
    <p className={cn("text-xs tabular-nums", above ? "text-destructive font-medium" : "text-muted-foreground")}>
      Orçado: {brl(item.total)}
      {above && " · acima do orçado"}
    </p>
  );
}

/** Lista os itens do orçamento da obra por semelhança; suprimentos escolhe. */
export function LinkBudgetItemDialog({
  open,
  onOpenChange,
  projectId,
  purchase,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  purchase: { item_name: string; category: string | null; orcamento_item_id?: string | null };
  onSelect: (itemId: string | null) => void;
}) {
  const { data, isLoading, error } = useProjectBudgetItems(projectId, open);
  const [q, setQ] = useState("");
  const ranked = useMemo(() => {
    const list = (data ?? []).filter(
      (i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()),
    );
    return list
      .map((i) => ({ i, s: similarityScore(purchase, { name: i.name, section: i.section ?? i.category }) }))
      .sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name, "pt-BR"))
      .map((x) => x.i);
  }, [data, q, purchase]);

  const pick = (item: ProjectBudgetItem | null) => {
    onSelect(item?.id ?? null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular ao orçamento</DialogTitle>
          <DialogDescription>{purchase.item_name}</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar item do orçamento"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11"
        />
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Não foi possível carregar o orçamento da obra.</p>
          ) : ranked.length === 0 ? (
            <EmptyState title="Nenhum item de orçamento" description="Esta obra não tem orçamento com itens cadastrados." />
          ) : (
            ranked.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "w-full min-h-11 rounded-md border px-3 py-2 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  purchase.orcamento_item_id === i.id && "border-primary bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{i.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{brl(i.total)}</span>
                </div>
                {(i.section || i.category) && (
                  <p className="text-xs text-muted-foreground">{i.section ?? i.category}</p>
                )}
              </button>
            ))
          )}
        </div>
        {purchase.orcamento_item_id && (
          <Button variant="outline" className="h-11" onClick={() => pick(null)}>
            Remover vínculo
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LinkBudgetButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8 gap-1" onClick={onClick}>
      <Link2 className="h-3.5 w-3.5" aria-hidden />
      Vincular ao orçamento
    </Button>
  );
}
