import { useMemo, useState, useRef, useCallback } from 'react';
import {
  MessageSquare, CheckCircle2, Clock, FileText, Upload, DollarSign,
  ClipboardList, ChevronDown, ChevronRight, MoreHorizontal, Trash2,
  Pencil, MapPin, Calendar, Warehouse, Building2, TruckIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig, PURCHASE_TYPE_LABELS, PURCHASE_TYPE_ICONS } from './types';
import { ObservationsModal } from './ObservationsModal';
import { PaymentFlowModal } from './PaymentFlowModal';
import { CadastroModal } from './CadastroModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';

interface PurchasesTableProps {
  purchases: ProjectPurchase[];
  getActivityName: (id: string | null) => string;
  getDaysUntilRequired: (date: string, status: PurchaseStatus) => number | null;
  onEdit: (purchase: ProjectPurchase) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PurchaseStatus) => void;
  onAddFirst: () => void;
  onUpdateActualCost: (id: string, cost: number | null) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
}

const fmt = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/* ─── Cost Difference Badge ─── */
function CostDiffBadge({ estimated, actual, showDetails = false }: {
  estimated: number;
  actual: number;
  showDetails?: boolean;
}) {
  const diff = actual - estimated;
  const pct = estimated > 0 ? ((diff / estimated) * 100) : 0;
  const isOver = diff > 0;

  if (diff === 0) return null;

  const color = isOver ? 'text-destructive' : 'text-[hsl(var(--success))]';
  const sign = isOver ? '+' : '';
  const arrow = isOver ? '↑' : '↓';

  if (showDetails) {
    return (
      <div className={cn('flex items-center gap-2 text-xs font-medium rounded-md px-2 py-1',
        isOver ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
      )}>
        <span>{arrow} {sign}{fmt(diff)}</span>
        <span className="opacity-70">({sign}{pct.toFixed(1)}%)</span>
      </div>
    );
  }

  return (
    <span className={cn('text-[10px] font-medium', color)}>
      {arrow} {sign}{fmt(diff)}
    </span>
  );
}

/* ─── Contract Upload Cell ─── */
function ContractCell({ purchase, onUpdateField }: {
  purchase: ProjectPurchase;
  onUpdateField: (id: string, field: string, value: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `purchases/${purchase.project_id}/${purchase.id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('project-documents').upload(path, file);
      if (uploadError) throw uploadError;
      
      onUpdateField(purchase.id, 'contract_file_path', path);
      toast.success('Contrato anexado');
    } catch (err: unknown) {
      console.error('Contract upload error:', err);
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Erro desconhecido';
      toast.error(`Erro ao enviar contrato: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleView = async () => {
    if (!purchase.contract_file_path) return;
    const { data } = await supabase.storage.from('project-documents').createSignedUrl(purchase.contract_file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
      {purchase.contract_file_path ? (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-primary/30 text-primary" onClick={handleView}>
          <FileText className="h-3 w-3" /> Ver
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3 w-3" /> {uploading ? '...' : 'Anexar'}
        </Button>
      )}
    </>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: PurchaseStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs font-medium border', config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/* ─── Inline Editable Field ─── */
function InlineField({
  type = 'text', value, placeholder, onSave, className, prefix,
}: {
  type?: 'text' | 'number' | 'date';
  value: string | number | null;
  placeholder?: string;
  onSave: (val: string) => void;
  className?: string;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        type={type}
        className={cn(
          'h-8 text-sm bg-transparent border-transparent hover:border-input focus:border-input transition-colors',
          prefix && 'pl-7',
          className,
        )}
        placeholder={placeholder}
        defaultValue={value ?? ''}
        onBlur={(e) => onSave(e.target.value)}
      />
    </div>
  );
}

/* ─── Expandable Purchase Row ─── */
function PurchaseRow({
  purchase, onEdit, onDelete, onStatusChange,
  onUpdateActualCost, onUpdateField,
  setObsModal, setFlowModal, setCadastroModal,
}: {
  purchase: ProjectPurchase;
  onEdit: (p: ProjectPurchase) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PurchaseStatus) => void;
  onUpdateActualCost: (id: string, cost: number | null) => void;
  onUpdateField: (id: string, field: string, value: string | null) => void;
  setObsModal: (v: { purchase: ProjectPurchase } | null) => void;
  setFlowModal: (v: { purchase: ProjectPurchase } | null) => void;
  setCadastroModal: (v: { purchase: ProjectPurchase } | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPrestador = purchase.purchase_type === 'prestador';

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      {/* Main row */}
      <div className={cn(
        'group flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors',
        'hover:bg-accent/30',
        expanded && 'bg-accent/20',
      )}>
        <CollapsibleTrigger asChild>
          <button className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors">
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </CollapsibleTrigger>

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_120px_120px_120px_auto] items-center gap-3">
          {/* Name + supplier */}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{purchase.item_name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {purchase.supplier_name && (
                <span className="truncate">{purchase.supplier_name}</span>
              )}
              {isPrestador && purchase.start_date && purchase.end_date && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Calendar className="h-3 w-3" />
                  {fmtDate(purchase.start_date)} → {fmtDate(purchase.end_date)}
                </span>
              )}
            </div>
          </div>

          {/* Cost */}
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium">{fmt(purchase.estimated_cost)}</p>
            {purchase.actual_cost != null && purchase.actual_cost > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  Real: {fmt(purchase.actual_cost)}
                </p>
                {purchase.estimated_cost != null && purchase.estimated_cost > 0 && (
                  <CostDiffBadge estimated={purchase.estimated_cost} actual={purchase.actual_cost} />
                )}
              </>
            )}
            {purchase.orcamento_item_id && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/70 mt-0.5">
                <FileText className="h-2.5 w-2.5" />
                Orçamento
              </span>
            )}
          </div>

          {/* Dates summary */}
          <div className="text-right hidden md:block">
            {isPrestador ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Início: {fmtDate(purchase.start_date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fim: {fmtDate(purchase.end_date)}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Compra: {fmtDate(purchase.planned_purchase_date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Entrega: {fmtDate(purchase.required_by_date)}
                </p>
              </>
            )}
          </div>

          {/* Status */}
          <div className="flex justify-end">
            <StatusBadge status={purchase.status} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', purchase.notes && 'text-primary')}
              onClick={(e) => { e.stopPropagation(); setObsModal({ purchase }); }}
              title="Observações"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(purchase)}>
                  <Pencil className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFlowModal({ purchase })}>
                  <DollarSign className="h-4 w-4 mr-2" /> Fluxo Financeiro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCadastroModal({ purchase })}>
                  <ClipboardList className="h-4 w-4 mr-2" /> Cadastro
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* Product-specific statuses */}
                {!isPrestador && (
                  <>
                    {purchase.status !== 'awaiting_approval' && (
                      <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'awaiting_approval')}>
                        Solic. Aprovação
                      </DropdownMenuItem>
                    )}
                    {purchase.status !== 'approved' && (
                      <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'approved')}>
                        Aprovar
                      </DropdownMenuItem>
                    )}
                    {purchase.status !== 'purchased' && (
                      <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'purchased')}>
                        Compra Realizada
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {purchase.status !== 'pending' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'pending')}>
                    <Clock className="h-4 w-4 mr-2" /> Marcar Pendente
                  </DropdownMenuItem>
                )}
                {purchase.status !== 'ordered' && purchase.status !== 'delivered' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'ordered')}>
                    {isPrestador ? 'Marcar Contratado' : 'Marcar como Pedido'}
                  </DropdownMenuItem>
                )}
                {purchase.status !== 'delivered' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'delivered')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> {isPrestador ? 'Marcar Concluído' : 'Marcar Entregue'}
                  </DropdownMenuItem>
                )}
                {!isPrestador && purchase.delivery_location === 'estoque' && purchase.status !== 'sent_to_site' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'sent_to_site')}>
                    <TruckIcon className="h-4 w-4 mr-2" /> Enviado p/ Obra
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(purchase.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <CollapsibleContent>
        <div className="px-4 py-4 pl-12 bg-accent/10 border-b border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Costs */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custos</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {purchase.orcamento_item_id ? 'Custo Orçamento' : 'Previsto'}
                  </label>
                  <InlineField
                    type="number"
                    value={purchase.estimated_cost}
                    placeholder="0,00"
                    prefix="R$"
                    className={cn('w-full', purchase.orcamento_item_id && 'opacity-60')}
                    onSave={(v) => onUpdateField(purchase.id, 'estimated_cost', v || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Custo Real</label>
                  <InlineField
                    type="number"
                    value={purchase.actual_cost}
                    placeholder="0,00"
                    prefix="R$"
                    className="w-full"
                    onSave={(v) => {
                      const val = parseFloat(v);
                      onUpdateActualCost(purchase.id, isNaN(val) ? null : val);
                    }}
                  />
                </div>
              </div>
              {/* Cost difference indicator */}
              {purchase.estimated_cost != null && purchase.estimated_cost > 0 &&
               purchase.actual_cost != null && purchase.actual_cost > 0 && (
                <div className="pt-1">
                  <CostDiffBadge estimated={purchase.estimated_cost} actual={purchase.actual_cost} showDetails />
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isPrestador ? 'Período do Serviço' : 'Datas'}
              </h4>
              <div className={cn('grid gap-2', isPrestador ? 'grid-cols-3' : 'grid-cols-2')}>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {isPrestador ? 'Contratação' : 'Data de Compra'}
                  </label>
                  <InlineField
                    type="date"
                    value={purchase.planned_purchase_date}
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'planned_purchase_date', v || null)}
                  />
                </div>
                {isPrestador ? (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Início obra</label>
                      <InlineField
                        type="date"
                        value={purchase.start_date}
                        className="w-full"
                        onSave={(v) => onUpdateField(purchase.id, 'start_date', v || null)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Fim obra</label>
                      <InlineField
                        type="date"
                        value={purchase.end_date}
                        className="w-full"
                        onSave={(v) => onUpdateField(purchase.id, 'end_date', v || null)}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Entrega na obra</label>
                    <InlineField
                      type="date"
                      value={purchase.required_by_date}
                      className="w-full"
                      onSave={(v) => onUpdateField(purchase.id, 'required_by_date', v || null)}
                    />
                  </div>
                )}
              </div>

              {/* Delivery address for products */}
              {!isPrestador && (
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> Local de Entrega
                  </label>
                  <InlineField
                    value={purchase.delivery_address}
                    placeholder="Endereço de entrega"
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'delivery_address', v || null)}
                  />
                </div>
              )}
            </div>

            {/* Supplier & Docs */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isPrestador ? 'Prestador & Docs' : 'Fornecedor & Docs'}
              </h4>
              <div className="space-y-2">
                <InlineField
                  value={purchase.supplier_name}
                  placeholder={isPrestador ? 'Nome do prestador' : 'Nome do fornecedor'}
                  className="w-full"
                  onSave={(v) => onUpdateField(purchase.id, 'supplier_name', v || null)}
                />
                <div className="flex items-center gap-2">
                  <ContractCell purchase={purchase} onUpdateField={onUpdateField} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setCadastroModal({ purchase })}
                  >
                    <ClipboardList className="h-3 w-3" /> Cadastro
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setFlowModal({ purchase })}
                  >
                    <DollarSign className="h-3 w-3" /> Fluxo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {purchase.description && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-sm text-muted-foreground">{purchase.description}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── Main Table Component ─── */
export function PurchasesTable({
  purchases, getActivityName, getDaysUntilRequired,
  onEdit, onDelete, onStatusChange, onAddFirst,
  onUpdateActualCost, onUpdateNotes, onUpdateField,
}: PurchasesTableProps) {
  const [obsModal, setObsModal] = useState<{ purchase: ProjectPurchase } | null>(null);
  const [flowModal, setFlowModal] = useState<{ purchase: ProjectPurchase } | null>(null);
  const [cadastroModal, setCadastroModal] = useState<{ purchase: ProjectPurchase } | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set(['produto', 'prestador']));

  // Group by purchase_type, then by category
  const grouped = useMemo(() => {
    const byType = new Map<string, Map<string, ProjectPurchase[]>>();
    
    for (const type of ['produto', 'prestador']) {
      byType.set(type, new Map());
    }

    for (const p of purchases) {
      const type = p.purchase_type || 'produto';
      const cat = p.category || 'Outros';
      if (!byType.has(type)) byType.set(type, new Map());
      const catMap = byType.get(type)!;
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(p);
    }

    // Remove empty types
    for (const [type, catMap] of byType) {
      if (catMap.size === 0) byType.delete(type);
    }

    return byType;
  }, [purchases]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">Nenhum item cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione produtos ou prestadores para esta obra.
          </p>
          <Button onClick={onAddFirst}>Adicionar primeiro item</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([purchaseType, categoryMap]) => {
          const typeLabel = PURCHASE_TYPE_LABELS[purchaseType as keyof typeof PURCHASE_TYPE_LABELS] || purchaseType;
          const typeIcon = PURCHASE_TYPE_ICONS[purchaseType as keyof typeof PURCHASE_TYPE_ICONS] || '📋';
          const isTypeOpen = expandedSections.has(purchaseType);
          const allItems = Array.from(categoryMap.values()).flat();
          const typeTotal = allItems.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
          const typeCompleted = allItems.filter(p => p.status === 'delivered').length;
          const typePct = allItems.length > 0 ? Math.round((typeCompleted / allItems.length) * 100) : 0;

          return (
            <div key={purchaseType} className="space-y-2">
              {/* Type Header */}
              <button
                onClick={() => toggleSection(purchaseType)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border hover:bg-accent/30 transition-colors text-left"
              >
                <div className="shrink-0">
                  {isTypeOpen
                    ? <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  }
                </div>
                <span className="text-lg">{typeIcon}</span>
                <span className="font-bold text-base">{typeLabel}</span>
                <Badge variant="secondary" className="text-xs">{allItems.length}</Badge>

                <div className="flex-1" />

                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 w-28">
                    <Progress value={typePct} className="h-2 flex-1" />
                    <span className="text-xs">{typePct}%</span>
                  </div>
                  <span className="font-semibold text-foreground">{fmt(typeTotal)}</span>
                </div>
              </button>

              {/* Category groups within type */}
              {isTypeOpen && (
                <div className="space-y-2 ml-2">
                  {Array.from(categoryMap.entries()).map(([category, items]) => {
                    const catKey = `${purchaseType}:${category}`;
                    const isCatOpen = expandedSections.has(catKey) || !expandedSections.has(`_init_${purchaseType}`);
                    const categoryTotal = items.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
                    const completedCount = items.filter(p => p.status === 'delivered').length;
                    const completionPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

                    return (
                      <Card key={catKey} className="overflow-hidden">
                        <button
                          onClick={() => toggleSection(catKey)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors text-left"
                        >
                          <div className="shrink-0">
                            {isCatOpen
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            }
                          </div>
                          <span className="font-semibold text-sm">{category}</span>
                          <Badge variant="secondary" className="text-xs">{items.length}</Badge>

                          <div className="flex-1" />

                          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 w-24">
                              <Progress value={completionPct} className="h-1.5 flex-1" />
                              <span>{completionPct}%</span>
                            </div>
                            <span className="font-medium text-foreground">{fmt(categoryTotal)}</span>
                          </div>
                        </button>

                        {isCatOpen && (
                          <div className="border-t border-border/50">
                            {items.map(purchase => (
                              <PurchaseRow
                                key={purchase.id}
                                purchase={purchase}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onStatusChange={onStatusChange}
                                onUpdateActualCost={onUpdateActualCost}
                                onUpdateField={onUpdateField}
                                setObsModal={setObsModal}
                                setFlowModal={setFlowModal}
                                setCadastroModal={setCadastroModal}
                              />
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {obsModal && (
        <ObservationsModal
          open={!!obsModal}
          onOpenChange={() => setObsModal(null)}
          itemName={obsModal.purchase.item_name}
          notes={obsModal.purchase.notes || ''}
          onSave={(notes) => onUpdateNotes(obsModal.purchase.id, notes)}
        />
      )}

      {flowModal && (
        <PaymentFlowModal
          open={!!flowModal}
          onOpenChange={() => setFlowModal(null)}
          purchaseId={flowModal.purchase.id}
          projectId={flowModal.purchase.project_id}
          itemName={flowModal.purchase.item_name}
        />
      )}

      {cadastroModal && (
        <CadastroModal
          open={!!cadastroModal}
          onOpenChange={() => setCadastroModal(null)}
          purchaseId={cadastroModal.purchase.id}
          projectId={cadastroModal.purchase.project_id}
          itemName={cadastroModal.purchase.item_name}
        />
      )}
    </>
  );
}
