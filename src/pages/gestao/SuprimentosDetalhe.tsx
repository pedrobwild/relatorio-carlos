/**
 * SuprimentosDetalhe — Onda E1
 * Itens, mapa de cotações e conversão em pedido.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Trophy,
  ShoppingCart,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { parseLocalDate } from "@/lib/dates";
import {
  useAddQuote,
  useAddRequisitionItem,
  useConvertRequisitionToPurchase,
  useRemoveQuote,
  useRemoveRequisitionItem,
  useRequisition,
  useRequisitionItems,
  useRequisitionQuotes,
  useSelectQuoteWinner,
  useUpdateRequisition,
  type RequisitionStatus,
} from "@/hooks/useSuprimentos";

const STATUS_META: Record<RequisitionStatus, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  em_cotacao: "Em cotação",
  pedido_emitido: "Pedido emitido",
  atendida: "Atendida",
  cancelada: "Cancelada",
};

function useFornecedores() {
  return useQuery({
    queryKey: ["fornecedores", "suprimentos-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export default function SuprimentosDetalhe() {
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();

  const reqQ = useRequisition(requisitionId);
  const itemsQ = useRequisitionItems(requisitionId);
  const quotesQ = useRequisitionQuotes(requisitionId);
  const fornQ = useFornecedores();

  const updateM = useUpdateRequisition();
  const convertM = useConvertRequisitionToPurchase();

  if (reqQ.isLoading) return <PageSkeleton />;
  if (!reqQ.data)
    return (
      <div className="p-8">
        <EmptyState
          icon={FileText}
          title="Requisição não encontrada"
          description="Ela pode ter sido removida."
        />
      </div>
    );

  const req = reqQ.data;
  const items = itemsQ.data ?? [];
  const quotes = quotesQ.data ?? [];
  const winner = quotes.find((q) => q.is_winner);
  const canConvert =
    !!winner &&
    items.length > 0 &&
    req.status !== "pedido_emitido" &&
    req.status !== "atendida" &&
    req.status !== "cancelada";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-safe-4 py-6 sm:px-safe-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Requisição</h1>
            <Badge variant="outline">{STATUS_META[req.status as RequisitionStatus]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Criada em{" "}
            {format(parseISO(req.created_at), "dd/MM/yyyy", { locale: ptBR })}
            {req.needed_by && (
              <>
                {" · Necessária em "}
                {format(parseLocalDate(req.needed_by), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={req.status}
            onValueChange={(v) =>
              updateM.mutate({ id: req.id, patch: { status: v } })
            }
          >
            <SelectTrigger className="min-h-[40px] w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as RequisitionStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => convertM.mutate(req.id)}
            disabled={!canConvert || convertM.isPending}
            className="min-h-[40px]"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Gerar pedido
          </Button>
        </div>
      </header>

      {req.notes && (
        <Card>
          <CardContent className="p-4 text-sm text-foreground/80 whitespace-pre-line">
            {req.notes}
          </CardContent>
        </Card>
      )}

      <ItemsSection requisitionId={req.id} items={items} />
      <QuotesSection
        requisitionId={req.id}
        quotes={quotes}
        fornecedores={fornQ.data ?? []}
      />

      {!winner && quotes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selecione uma cotação vencedora para habilitar "Gerar pedido".
        </p>
      )}

      {req.status === "pedido_emitido" && (
        <p className="text-xs text-muted-foreground">
          Pedido já emitido — acompanhe no{" "}
          <Link
            to="/gestao/calendario-compras"
            className="text-primary underline"
          >
            Calendário de Compras
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function ItemsSection({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    categoria: string | null;
    observacao: string | null;
  }>;
}) {
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState("un");
  const [categoria, setCategoria] = useState("");
  const [observacao, setObservacao] = useState("");
  const addM = useAddRequisitionItem();
  const removeM = useRemoveRequisitionItem(requisitionId);

  const canAdd = descricao.trim().length > 0 && Number(quantidade) > 0;

  const submit = async () => {
    if (!canAdd) return;
    await addM.mutateAsync({
      requisition_id: requisitionId,
      descricao,
      quantidade: Number(quantidade),
      unidade,
      categoria: categoria || null,
      observacao: observacao || null,
    });
    setDescricao("");
    setQuantidade("1");
    setUnidade("un");
    setCategoria("");
    setObservacao("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Itens ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-start gap-3 p-3 sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{it.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(it.quantidade)} {it.unidade}
                    {it.categoria && ` · ${it.categoria}`}
                    {it.observacao && ` · ${it.observacao}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeM.mutate(it.id)}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Cimento CP-II 50kg"
            />
          </div>
          <div>
            <Label className="text-xs">Qtd *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Unidade</Label>
            <Input
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="sm:col-span-6">
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
          <div className="sm:col-span-6 flex justify-end">
            <Button onClick={submit} disabled={!canAdd || addM.isPending} className="min-h-[40px]">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar item
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuotesSection({
  requisitionId,
  quotes,
  fornecedores,
}: {
  requisitionId: string;
  quotes: Array<{
    id: string;
    supplier_id: string | null;
    valor_total: number | null;
    prazo_entrega_dias: number | null;
    frete: number | null;
    validade: string | null;
    observacao: string | null;
    is_winner: boolean;
  }>;
  fornecedores: Array<{ id: string; nome: string }>;
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("");
  const [frete, setFrete] = useState<string>("");
  const [validade, setValidade] = useState<string>("");
  const [obs, setObs] = useState<string>("");

  const addM = useAddQuote();
  const removeM = useRemoveQuote(requisitionId);
  const winnerM = useSelectQuoteWinner(requisitionId);

  const canAdd = !!supplierId && !addM.isPending;

  const submit = async () => {
    if (!canAdd) return;
    await addM.mutateAsync({
      requisition_id: requisitionId,
      supplier_id: supplierId,
      valor_total: valor ? Number(valor) : null,
      prazo_entrega_dias: prazo ? Number(prazo) : null,
      frete: frete ? Number(frete) : null,
      validade: validade || null,
      observacao: obs || null,
    });
    setSupplierId("");
    setValor("");
    setPrazo("");
    setFrete("");
    setValidade("");
    setObs("");
  };

  const best = useMemo(() => {
    const withPrice = quotes.filter((q) => q.valor_total != null);
    const withLead = quotes.filter((q) => q.prazo_entrega_dias != null);
    return {
      priceId: withPrice.length
        ? withPrice.reduce((a, b) =>
            (a.valor_total ?? 0) < (b.valor_total ?? 0) ? a : b,
          ).id
        : null,
      leadId: withLead.length
        ? withLead.reduce((a, b) =>
            (a.prazo_entrega_dias ?? 0) < (b.prazo_entrega_dias ?? 0) ? a : b,
          ).id
        : null,
    };
  }, [quotes]);

  const supplierName = (id: string | null) =>
    fornecedores.find((f) => f.id === id)?.nome ?? "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cotações ({quotes.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Registre cotações por fornecedor para comparar preço e prazo.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotes.map((q) => {
              const isBestPrice = best.priceId === q.id;
              const isBestLead = best.leadId === q.id;
              return (
                <div
                  key={q.id}
                  className={`rounded-md border p-3 ${
                    q.is_winner
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {supplierName(q.supplier_id)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.is_winner && (
                          <Badge className="gap-1">
                            <Trophy className="h-3 w-3" /> Vencedora
                          </Badge>
                        )}
                        {isBestPrice && !q.is_winner && (
                          <Badge variant="secondary">Melhor preço</Badge>
                        )}
                        {isBestLead && !q.is_winner && (
                          <Badge variant="secondary">Menor prazo</Badge>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover cotação"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover cotação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeM.mutate(q.id)}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-muted-foreground">Valor total</dt>
                    <dd className="text-right font-medium">
                      {q.valor_total != null
                        ? `R$ ${Number(q.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Prazo</dt>
                    <dd className="text-right">
                      {q.prazo_entrega_dias != null
                        ? `${q.prazo_entrega_dias} dias`
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Frete</dt>
                    <dd className="text-right">
                      {q.frete != null
                        ? `R$ ${Number(q.frete).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </dd>
                    <dt className="text-muted-foreground">Validade</dt>
                    <dd className="text-right">
                      {q.validade
                        ? format(parseLocalDate(q.validade), "dd/MM/yyyy")
                        : "—"}
                    </dd>
                  </dl>
                  {q.observacao && (
                    <p className="mt-2 text-xs text-foreground/70">
                      {q.observacao}
                    </p>
                  )}
                  {!q.is_winner && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => winnerM.mutate(q.id)}
                      disabled={winnerM.isPending}
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      Selecionar vencedora
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label className="text-xs">Fornecedor *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor total</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Prazo (dias)</Label>
            <Input
              type="number"
              min="0"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Frete</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Validade</Label>
            <Input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div className="sm:col-span-6">
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
            />
          </div>
          <div className="sm:col-span-6 flex justify-end">
            <Button onClick={submit} disabled={!canAdd} className="min-h-[40px]">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar cotação
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
