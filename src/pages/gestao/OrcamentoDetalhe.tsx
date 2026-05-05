import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Building2,
  Clock,
  FileText,
  ExternalLink,
  Send,
  AlertTriangle,
  Link as LinkIcon,
  MapPin,
  Ruler,
  Package,
  DollarSign,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatBRL";
import { PageSkeleton, EmptyState, StatusBadge } from "@/components/ui-premium";
import {
  BUDGET_STATUS_TONE,
  BUDGET_STATUS_LABEL,
  PRIORITY_TONE,
  PRIORITY_LABEL,
  getTone,
  getLabel,
} from "@/lib/statusTones";

// Status config
const STATUSES: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Solicitado",
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "Em Produção",
    className: "bg-primary/10 text-primary",
  },
  review: {
    label: "Revisão",
    className: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  },
  waiting_info: {
    label: "Aguardando Info",
    className: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  },
  blocked: {
    label: "Bloqueado",
    className: "bg-destructive/10 text-destructive",
  },
  ready: {
    label: "Pronto",
    className: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  },
  sent_to_client: {
    label: "Enviado ao Cliente",
    className: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  },
  approved: {
    label: "Aprovado",
    className: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  },
  rejected: {
    label: "Recusado",
    className: "bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

const PRIORITIES: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-muted-foreground" },
  normal: { label: "Normal", className: "" },
  high: { label: "Alta", className: "text-[hsl(var(--warning))]" },
  urgent: { label: "Urgente", className: "text-destructive" },
};

const QUICK_TEMPLATES = [
  "Aguardo retorno do comercial",
  "Informação solicitada ao cliente",
  "Orçamento revisado — pronto para envio",
];

function calcSalePrice(cost: number, bdi: number): number {
  return cost * (1 + bdi / 100);
}

export default function OrcamentoDetalhe({
  embeddedOrcamentoId,
}: { embeddedOrcamentoId?: string } = {}) {
  const params = useParams<{ orcamentoId: string }>();
  const orcamentoId = embeddedOrcamentoId || params.orcamentoId;
  const isEmbedded = !!embeddedOrcamentoId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Fetch budget
  const { data: budget, isLoading } = useQuery({
    queryKey: queryKeys.orcamentos.detail(orcamentoId),
    queryFn: async () => {
      if (!orcamentoId) return null;
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("id", orcamentoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orcamentoId,
  });

  // Fetch sections with items
  const { data: sections } = useQuery({
    queryKey: queryKeys.orcamentos.sections(orcamentoId),
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from("orcamento_sections")
        .select(
          "id, title, subtitle, notes, order_index, section_price, is_optional, cover_image_url, included_bullets, excluded_bullets, tags, cost, bdi_percentage, item_count, orcamento_items(id, title, description, qty, unit, internal_unit_price, internal_total, bdi_percentage, order_index, included_rooms, excluded_rooms, coverage_type, reference_url, notes, item_category, supplier_id, supplier_name, catalog_item_id)",
        )
        .eq("orcamento_id", orcamentoId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        orcamento_items: (s.orcamento_items || []).sort(
          (a: any, b: any) => (a.order_index || 0) - (b.order_index || 0),
        ),
      }));
    },
    enabled: !!orcamentoId,
  });

  // Fetch adjustments
  const { data: adjustments } = useQuery({
    queryKey: queryKeys.orcamentos.adjustments(orcamentoId),
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from("orcamento_adjustments")
        .select("id, label, amount, sign, order_index")
        .eq("orcamento_id", orcamentoId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orcamentoId,
  });

  // Fetch notes
  const { data: notes } = useQuery({
    queryKey: queryKeys.orcamentos.notes(orcamentoId),
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from("orcamento_notas")
        .select("id, body, user_id, created_at")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orcamentoId,
  });

  // Fetch events
  const { data: events } = useQuery({
    queryKey: queryKeys.orcamentos.events(orcamentoId),
    queryFn: async () => {
      if (!orcamentoId) return [];
      const { data, error } = await supabase
        .from("orcamento_eventos")
        .select(
          "id, event_type, from_status, to_status, note, user_id, created_at",
        )
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orcamentoId,
  });

  // Fetch profiles for name resolution
  const { data: profiles } = useQuery({
    queryKey: queryKeys.staffProfiles.lookup(),
    queryFn: async () => {
      const { data } = await supabase
        .from("users_profile")
        .select("id, nome, email")
        .limit(500);
      return data || [];
    },
    staleTime: 15 * 60 * 1000, // 15 min — rarely changes
    gcTime: 30 * 60 * 1000,
  });

  const getProfileName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      const p = profiles?.find((p: any) => p.id === id);
      return p?.nome || p?.email?.split("@")[0] || id.slice(0, 8);
    },
    [profiles],
  );

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!budget || !user) throw new Error("Missing data");
      const oldStatus = budget.internal_status;

      const { error: updateErr } = await supabase
        .from("orcamentos")
        .update({
          internal_status: newStatus as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", budget.id);
      if (updateErr) throw updateErr;

      const { error: evtErr } = await supabase
        .from("orcamento_eventos")
        .insert({
          orcamento_id: budget.id,
          user_id: user.id,
          event_type: "status_change",
          from_status: oldStatus,
          to_status: newStatus,
        });
      if (evtErr) throw evtErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orcamentos.all });
      toast.success("Status atualizado");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!orcamentoId || !user) throw new Error("Missing data");
      const { error: noteErr } = await supabase.from("orcamento_notas").insert({
        orcamento_id: orcamentoId,
        user_id: user.id,
        body,
      });
      if (noteErr) throw noteErr;

      const { error: evtErr } = await supabase
        .from("orcamento_eventos")
        .insert({
          orcamento_id: orcamentoId,
          user_id: user.id,
          event_type: "comment",
          note: body.slice(0, 200),
        });
      if (evtErr) throw evtErr;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({
        queryKey: queryKeys.orcamentos.notes(orcamentoId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.orcamentos.events(orcamentoId),
      });
      toast.success("Nota adicionada");
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar nota: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton metrics={false} content="cards" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="Orçamento não encontrado"
          description="O orçamento solicitado não existe ou foi removido."
          action={{
            label: "Voltar",
            onClick: () => navigate(-1),
            icon: ArrowLeft,
            variant: "outline",
          }}
          size="md"
        />
      </div>
    );
  }

  const status = STATUSES[budget.internal_status] || STATUSES.requested;
  const prio = PRIORITIES[budget.priority] || PRIORITIES.normal;
  const links = (budget.reference_links ?? []).filter((l: string) => l?.trim());

  // Use server-side totals if available, otherwise calculate
  const hasServerTotals =
    budget.total_value != null || budget.total_sale != null;

  let grandCost = 0;
  let grandSale = 0;
  const sectionSummaries = (sections || []).map((sec: any) => {
    let secCost = 0;
    let secSale = 0;
    const itemRows = (sec.orcamento_items || []).map((item: any) => {
      const qty = Number(item.qty) || 0;
      const cost = Number(item.internal_unit_price) || 0;
      const bdi = Number(item.bdi_percentage) || 0;
      const sale = calcSalePrice(cost, bdi);
      const totalCost =
        qty > 0 ? qty * cost : Number(item.internal_total) || cost;
      const totalSale = qty > 0 ? qty * sale : calcSalePrice(totalCost, bdi);
      secCost += totalCost;
      secSale += totalSale;
      return { ...item, cost, bdi, sale, totalCost, totalSale, qty };
    });
    const effectiveCost = sec.cost != null ? Number(sec.cost) : secCost;
    const effectiveSale =
      sec.section_price != null && sec.section_price > 0
        ? Number(sec.section_price)
        : secSale;
    grandCost += effectiveCost;
    grandSale += effectiveSale;
    const secBdi =
      sec.bdi_percentage != null
        ? Number(sec.bdi_percentage)
        : effectiveCost > 0
          ? (effectiveSale / effectiveCost - 1) * 100
          : 0;
    return {
      ...sec,
      itemRows,
      secCost: effectiveCost,
      secSale: effectiveSale,
      secBdi,
    };
  });

  // Adjustments total
  const adjustmentsTotal = (adjustments || []).reduce(
    (sum: number, adj: any) => sum + Number(adj.amount) * Number(adj.sign),
    0,
  );

  // Use server totals or calculated
  const finalSale = hasServerTotals
    ? Number(budget.total_sale ?? grandSale)
    : grandSale;
  const finalCost = hasServerTotals
    ? Number(budget.total_cost ?? grandCost)
    : grandCost;
  const finalValue = hasServerTotals
    ? Number(budget.total_value ?? finalSale)
    : grandSale + adjustmentsTotal;
  const grandBdi =
    hasServerTotals && budget.avg_bdi != null
      ? Number(budget.avg_bdi)
      : finalCost > 0
        ? (finalSale / finalCost - 1) * 100
        : 0;
  const margin =
    hasServerTotals && budget.net_margin != null
      ? Number(budget.net_margin)
      : finalSale - finalCost;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {!isEmbedded && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/gestao/orcamentos")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {budget.sequential_code && (
                <span className="text-xs font-mono text-muted-foreground">
                  {budget.sequential_code}
                </span>
              )}
              <h1 className="text-lg font-semibold truncate">
                {budget.project_name}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {budget.client_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge
            tone={getTone(
              BUDGET_STATUS_TONE,
              budget.internal_status,
              "neutral",
            )}
            size="md"
          >
            {getLabel(
              BUDGET_STATUS_LABEL,
              budget.internal_status,
              status.label,
            )}
          </StatusBadge>
          <StatusBadge
            tone={getTone(PRIORITY_TONE, budget.priority, "neutral")}
            size="md"
            variant="outline"
            showDot={false}
          >
            {getLabel(PRIORITY_LABEL, budget.priority, prio.label)}
          </StatusBadge>

          <Select
            value={budget.internal_status}
            onValueChange={(v) => statusMutation.mutate(v)}
          >
            <SelectTrigger className="h-7 w-auto text-xs gap-1 border-dashed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUSES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Demand Context */}
          {budget.demand_context && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  💬 Contexto da Demanda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {budget.demand_context}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Briefing */}
          {budget.briefing && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Briefing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {budget.briefing}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Internal Notes */}
          {budget.internal_notes && (
            <Card className="border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-[hsl(var(--warning))]">
                  <AlertTriangle className="h-4 w-4" />
                  Observações Internas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {budget.internal_notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Reference Links */}
          {links.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  Links de Referência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {links.map((link: string, i: number) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline truncate"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {link}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!budget.briefing &&
            !budget.demand_context &&
            !budget.internal_notes &&
            links.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-10 flex flex-col items-center text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum briefing ou instrução cadastrada para este orçamento.
                  </p>
                </CardContent>
              </Card>
            )}

          {/* Budget Breakdown */}
          {sectionSummaries.length > 0 && (
            <Card>
              <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Estrutura do Orçamento ({sectionSummaries.length} seções)
                    </CardTitle>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${breakdownOpen ? "rotate-180" : ""}`}
                    />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Grand totals */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <MiniStat
                        label="Total Venda"
                        value={formatBRL(finalSale)}
                        icon={<DollarSign className="h-3.5 w-3.5" />}
                        accent
                      />
                      <MiniStat
                        label="Total Custo"
                        value={formatBRL(finalCost)}
                        icon={<DollarSign className="h-3.5 w-3.5" />}
                      />
                      <MiniStat
                        label="BDI Médio"
                        value={`${grandBdi.toFixed(1)}%`}
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                      />
                      <MiniStat
                        label="Margem Líquida"
                        value={formatBRL(margin)}
                        icon={<TrendingUp className="h-3.5 w-3.5" />}
                        accent={margin > 0}
                      />
                      {finalValue !== finalSale && (
                        <MiniStat
                          label="Valor Final"
                          value={formatBRL(finalValue)}
                          icon={<DollarSign className="h-3.5 w-3.5" />}
                          accent
                        />
                      )}
                    </div>

                    {/* Sections */}
                    {sectionSummaries.map((sec: any) => (
                      <SectionBlock key={sec.id} section={sec} />
                    ))}

                    {/* Adjustments */}
                    {(adjustments || []).length > 0 && (
                      <div className="p-3 rounded-lg border border-dashed border-border space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ajustes Financeiros
                        </p>
                        {adjustments!.map((adj: any) => (
                          <div
                            key={adj.id}
                            className="flex justify-between text-sm"
                          >
                            <span>{adj.label}</span>
                            <span
                              className={`font-medium tabular-nums ${Number(adj.sign) < 0 ? "text-destructive" : "text-[hsl(var(--success))]"}`}
                            >
                              {Number(adj.sign) < 0 ? "−" : "+"}{" "}
                              {formatBRL(Math.abs(Number(adj.amount)))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Notes / Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                💬 Notas Internas ({notes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(!notes || notes.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma nota interna ainda. Adicione a primeira abaixo.
                </p>
              )}
              {notes?.map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">
                        {getProfileName(c.user_id)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}

              <Separator />

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2">
                {QUICK_TEMPLATES.map((tpl) => (
                  <Button
                    key={tpl}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      setNewComment(tpl);
                      commentRef.current?.focus();
                    }}
                  >
                    {tpl}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Textarea
                  ref={commentRef}
                  placeholder="Escreva uma nota interna... (digite / para templates)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1 text-sm"
                  maxLength={2000}
                />
                <Button
                  size="icon"
                  disabled={!newComment.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate(newComment.trim())}
                  className="shrink-0 self-end"
                >
                  {commentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Property */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Imóvel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(budget.bairro || budget.city) && (
                <InfoRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Local"
                  value={[budget.bairro, budget.city]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              {budget.condominio && (
                <InfoRow
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label="Condomínio"
                  value={budget.condominio}
                />
              )}
              {budget.metragem && (
                <InfoRow
                  icon={<Ruler className="h-3.5 w-3.5" />}
                  label="Metragem"
                  value={budget.metragem}
                />
              )}
              {!budget.bairro && !budget.city && !budget.metragem && (
                <p className="text-muted-foreground text-xs">
                  Sem dados do imóvel.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Ownership */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Responsáveis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Comercial"
                value={getProfileName(budget.commercial_owner_id)}
              />
              <InfoRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Orçamentista"
                value={getProfileName(budget.estimator_owner_id)}
              />
              <InfoRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Criado por"
                value={getProfileName(budget.created_by)}
              />
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {budget.created_at && (
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Criado"
                  value={format(
                    new Date(budget.created_at),
                    "dd/MM/yyyy HH:mm",
                  )}
                />
              )}
              {budget.updated_at && (
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Atualizado"
                  value={format(
                    new Date(budget.updated_at),
                    "dd/MM/yyyy HH:mm",
                  )}
                />
              )}
              {budget.due_at && (
                <InfoRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Prazo"
                  value={format(new Date(budget.due_at), "dd/MM/yyyy")}
                />
              )}
            </CardContent>
          </Card>

          {/* History / Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                📋 Histórico ({events?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!events || events.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum evento registrado.
                </p>
              )}
              <div className="space-y-0">
                {events?.map((ev: any, i: number) => {
                  const isLast = i === (events?.length || 0) - 1;
                  const statusTo = ev.to_status ? STATUSES[ev.to_status] : null;
                  return (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${ev.event_type === "comment" ? "bg-primary/60" : "bg-primary"}`}
                        />
                        {!isLast && (
                          <div className="w-px flex-1 bg-border min-h-[24px]" />
                        )}
                      </div>
                      <div className="pb-4 min-w-0">
                        <p className="text-xs leading-snug">
                          <span className="font-medium">
                            {getProfileName(ev.user_id)}
                          </span>
                          {ev.event_type === "status_change" && statusTo ? (
                            <>
                              {" "}
                              alterou status para{" "}
                              <span className="font-medium">
                                {statusTo.label}
                              </span>
                            </>
                          ) : ev.event_type === "comment" ? (
                            " — comentou"
                          ) : (
                            ` — ${ev.event_type}`
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(ev.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function MiniStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${accent ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionBlock({ section }: { section: any }) {
  const [open, setOpen] = useState(false);
  const includedBullets =
    section.included_bullets?.filter((b: string) => b?.trim()) || [];
  const excludedBullets =
    section.excluded_bullets?.filter((b: string) => b?.trim()) || [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
            />
            <span className="text-sm font-medium truncate">
              {section.title || "Seção"}
            </span>
            {section.is_optional && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] shrink-0">
                Opcional
              </span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              ({section.itemRows.length} itens)
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
            <span className="text-muted-foreground">
              Custo: {formatBRL(section.secCost)}
            </span>
            <span className="text-muted-foreground">
              BDI: {section.secBdi.toFixed(1)}%
            </span>
            <span className="font-semibold">
              Venda: {formatBRL(section.secSale)}
            </span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 mt-1 border-l-2 border-border pl-3 space-y-3">
          {/* Section subtitle/notes */}
          {(section.subtitle || section.notes) && (
            <div className="px-2 py-1.5 space-y-1">
              {section.subtitle && (
                <p className="text-xs text-muted-foreground italic">
                  {section.subtitle}
                </p>
              )}
              {section.notes && (
                <p className="text-xs text-muted-foreground">{section.notes}</p>
              )}
            </div>
          )}

          {/* Included / Excluded bullets */}
          {(includedBullets.length > 0 || excludedBullets.length > 0) && (
            <div className="px-2 py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {includedBullets.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-[hsl(var(--success))] mb-1">
                    ✓ Incluso
                  </p>
                  <ul className="space-y-0.5">
                    {includedBullets.map((b: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        • {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {excludedBullets.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-destructive mb-1">
                    ✗ Não incluso
                  </p>
                  <ul className="space-y-0.5">
                    {excludedBullets.map((b: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        • {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Items table */}
          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_60px_80px_60px_80px_80px] gap-2 px-2 py-1.5 text-[11px] text-muted-foreground font-medium border-b border-border">
              <span>Item</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">$ Custo</span>
              <span className="text-right">% BDI</span>
              <span className="text-right">$ Venda</span>
              <span className="text-right">Total Venda</span>
            </div>
            {section.itemRows.map((item: any) => (
              <div key={item.id} className="group">
                <div className="grid grid-cols-[1fr_60px_80px_60px_80px_80px] gap-2 px-2 py-1.5 text-xs border-b border-border/50 last:border-b-0 hover:bg-muted/20">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{item.title || "—"}</span>
                      {item.item_category && (
                        <Badge
                          variant="secondary"
                          className={
                            item.item_category === "prestador"
                              ? "bg-primary/10 text-primary text-[10px] px-1.5 py-0"
                              : "bg-muted text-muted-foreground text-[10px] px-1.5 py-0"
                          }
                        >
                          {item.item_category === "prestador"
                            ? "Prestador"
                            : "Produto"}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <span className="text-[11px] text-muted-foreground truncate block">
                        {item.description}
                      </span>
                    )}
                    {item.supplier_name && (
                      <span className="text-[10px] text-muted-foreground/70 truncate block">
                        Fornecedor: {item.supplier_name}
                      </span>
                    )}
                  </div>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {item.qty || "—"}
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {item.cost > 0 ? formatBRL(item.cost) : "—"}
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {item.bdi > 0 ? `${item.bdi}%` : "—"}
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {item.sale > 0 ? formatBRL(item.sale) : "—"}
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {item.totalSale > 0 ? formatBRL(item.totalSale) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
