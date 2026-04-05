import { useMemo, useState, useRef, useCallback } from 'react';
import {
  MessageSquare, CheckCircle2, Clock, FileText, Upload, DollarSign,
  ClipboardList, ChevronDown, ChevronRight, MoreHorizontal, Trash2,
  Pencil, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig, isServiceCategory } from './types';
import { getAllSupplierSubcategories } from '@/constants/supplierCategories';
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
      const path = `purchases/${purchase.project_id}/${purchase.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('project-documents').upload(path, file);
      if (error) throw error;
      onUpdateField(purchase.id, 'contract_file_path', path);
      toast.success('Contrato anexado');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar contrato');
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
          {/* Name + description */}
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{purchase.item_name}</p>
            {purchase.supplier_name && (
              <p className="text-xs text-muted-foreground truncate">{purchase.supplier_name}</p>
            )}
          </div>

          {/* Cost */}
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium">{fmt(purchase.estimated_cost)}</p>
            {purchase.actual_cost != null && purchase.actual_cost > 0 && (
              <p className={cn(
                'text-xs',
                purchase.actual_cost > (purchase.estimated_cost || 0)
                  ? 'text-destructive' : 'text-[hsl(var(--success))]'
              )}>
                Real: {fmt(purchase.actual_cost)}
              </p>
            )}
          </div>

          {/* Dates summary */}
          <div className="text-right hidden md:block">
            <p className="text-xs text-muted-foreground">
              {purchase.start_date ? fmtDate(purchase.start_date) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              → {purchase.end_date ? fmtDate(purchase.end_date) : '—'}
            </p>
          </div>

          {/* Status */}
          <div className="flex justify-end">
            <StatusBadge status={purchase.status} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Quick action buttons */}
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
                  <Pencil className="h-4 w-4 mr-2" /> Editar Item
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFlowModal({ purchase })}>
                  <DollarSign className="h-4 w-4 mr-2" /> Fluxo Financeiro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCadastroModal({ purchase })}>
                  <ClipboardList className="h-4 w-4 mr-2" /> Cadastro
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {purchase.status !== 'pending' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'pending')}>
                    <Clock className="h-4 w-4 mr-2" /> Marcar Pendente
                  </DropdownMenuItem>
                )}
                {purchase.status !== 'ordered' && purchase.status !== 'delivered' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'ordered')}>
                    Marcar como Pedido
                  </DropdownMenuItem>
                )}
                {purchase.status !== 'delivered' && (
                  <DropdownMenuItem onClick={() => onStatusChange(purchase.id, 'delivered')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar Concluído
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
                  <label className="text-xs text-muted-foreground block mb-1">Previsto</label>
                  <InlineField
                    type="number"
                    value={purchase.estimated_cost}
                    placeholder="0,00"
                    prefix="R$"
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'estimated_cost', v || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Real</label>
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
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datas</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Contratação</label>
                  <InlineField
                    type="date"
                    value={purchase.planned_purchase_date}
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'planned_purchase_date', v || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Início</label>
                  <InlineField
                    type="date"
                    value={purchase.start_date}
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'start_date', v || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Conclusão</label>
                  <InlineField
                    type="date"
                    value={purchase.end_date}
                    className="w-full"
                    onSave={(v) => onUpdateField(purchase.id, 'end_date', v || null)}
                  />
                </div>
              </div>
            </div>

            {/* Supplier & Docs */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fornecedor & Docs</h4>
              <div className="space-y-2">
                <InlineField
                  value={purchase.supplier_name}
                  placeholder="Nome do fornecedor"
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

          {/* Description */}
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectPurchase[]>();
    for (const p of purchases) {
      const cat = p.category || 'Outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    const order = [...getAllSupplierSubcategories(), 'Outros'];
    const sorted = new Map<string, ProjectPurchase[]>();
    for (const cat of order) {
      if (map.has(cat)) sorted.set(cat, map.get(cat)!);
    }
    for (const [cat, items] of map) {
      if (!sorted.has(cat)) sorted.set(cat, items);
    }
    return sorted;
  }, [purchases]);

  // Auto-expand all categories
  const allCategoryKeys = useMemo(() => new Set(grouped.keys()), [grouped]);
  const effectiveExpanded = expandedCategories.size === 0 ? allCategoryKeys : expandedCategories;

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
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
          <h3 className="font-medium mb-1">Nenhum item de compra</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comece adicionando o primeiro item para esta obra.
          </p>
          <Button onClick={onAddFirst}>Adicionar primeiro item</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([category, items]) => {
          const isService = isServiceCategory(category);
          const isOpen = effectiveExpanded.has(category);
          const categoryTotal = items.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
          const categoryActual = items.reduce((sum, p) => sum + (p.actual_cost || 0), 0);
          const completedCount = items.filter(p => p.status === 'delivered').length;
          const completionPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

          return (
            <Card key={category} className="overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="shrink-0">
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <span className="text-sm">{isService ? '🔧' : '📦'}</span>
                <span className="font-semibold text-sm">{category}</span>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>

                <div className="flex-1" />

                {/* Mini progress */}
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 w-24">
                    <Progress value={completionPct} className="h-1.5 flex-1" />
                    <span>{completionPct}%</span>
                  </div>
                  <span className="font-medium text-foreground">{fmt(categoryTotal)}</span>
                  {categoryActual > 0 && (
                    <span className={cn(
                      'font-medium',
                      categoryActual > categoryTotal ? 'text-destructive' : 'text-[hsl(var(--success))]',
                    )}>
                      {fmt(categoryActual)}
                    </span>
                  )}
                </div>
              </button>

              {/* Items */}
              {isOpen && (
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
