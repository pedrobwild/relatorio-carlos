import { useMemo, useState, useRef } from 'react';
import { MessageSquare, CheckCircle2, Clock, FileText, Upload, DollarSign, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ProjectPurchase, PurchaseStatus } from '@/hooks/useProjectPurchases';
import { statusConfig, isServiceCategory, ITEM_CATEGORIES, SERVICE_CATEGORIES } from './types';
import { ObservationsModal } from './ObservationsModal';
import { PaymentFlowModal } from './PaymentFlowModal';
import { CadastroModal } from './CadastroModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

function ContractCell({ purchase, onUpdateField }: { purchase: ProjectPurchase; onUpdateField: (id: string, field: string, value: string | null) => void }) {
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
    <div className="flex items-center gap-1">
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
      {purchase.contract_file_path ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleView} title="Ver contrato">
          <FileText className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={purchase.contract_file_path ? 'Substituir contrato' : 'Anexar contrato'}
      >
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function PurchasesTable({
  purchases, getActivityName, getDaysUntilRequired,
  onEdit, onDelete, onStatusChange, onAddFirst,
  onUpdateActualCost, onUpdateNotes, onUpdateField,
}: PurchasesTableProps) {
  const [obsModal, setObsModal] = useState<{ purchase: ProjectPurchase } | null>(null);
  const [flowModal, setFlowModal] = useState<{ purchase: ProjectPurchase } | null>(null);
  const [cadastroModal, setCadastroModal] = useState<{ purchase: ProjectPurchase } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectPurchase[]>();
    for (const p of purchases) {
      const cat = p.category || 'Outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    const order = [...ITEM_CATEGORIES, ...SERVICE_CATEGORIES, 'Outros'];
    const sorted = new Map<string, ProjectPurchase[]>();
    for (const cat of order) {
      if (map.has(cat)) sorted.set(cat, map.get(cat)!);
    }
    for (const [cat, items] of map) {
      if (!sorted.has(cat)) sorted.set(cat, items);
    }
    return sorted;
  }, [purchases]);

  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum item de compra encontrado</p>
          <Button variant="link" onClick={onAddFirst}>Adicionar primeiro item</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([category, items]) => {
          const isService = isServiceCategory(category);
          const categoryTotal = items.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
          const categoryActual = items.reduce((sum, p) => sum + (p.actual_cost || 0), 0);
          const contracted = items.filter(p => p.status !== 'pending' && p.status !== 'cancelled').length;

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isService ? '🔧' : '📦'} {category}
                    <Badge variant="secondary" className="ml-1">{items.length}</Badge>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Previsto: <strong className="text-foreground">{fmt(categoryTotal)}</strong></span>
                    {categoryActual > 0 && (
                      <span>Real: <strong className="text-foreground">{fmt(categoryActual)}</strong></span>
                    )}
                    {contracted > 0 && (
                      <Badge variant="outline" className="gap-1 border-green-500/30 text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> {contracted}/{items.length}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Item</TableHead>
                      <TableHead className="min-w-[110px]">Custo Previsto</TableHead>
                      <TableHead className="min-w-[110px]">Custo Real</TableHead>
                      <TableHead className="min-w-[120px]">Data Contratação</TableHead>
                      <TableHead className="min-w-[120px]">Data Início</TableHead>
                      <TableHead className="min-w-[120px]">Data Conclusão</TableHead>
                      <TableHead className="min-w-[140px]">Fornecedor</TableHead>
                      <TableHead className="min-w-[90px]">Cadastro</TableHead>
                      <TableHead className="min-w-[80px]">Contrato</TableHead>
                      <TableHead className="min-w-[90px]">Financeiro</TableHead>
                      <TableHead className="w-12">Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(purchase => {
                      const config = statusConfig[purchase.status];
                      const StatusIcon = config.icon;

                      return (
                        <TableRow key={purchase.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{purchase.item_name}</p>
                              {purchase.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-48">{purchase.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 w-28 text-sm"
                              placeholder="0,00"
                              defaultValue={purchase.estimated_cost ?? ''}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateField(purchase.id, 'estimated_cost', isNaN(val) ? null : String(val));
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-8 w-28 text-sm"
                              placeholder="0,00"
                              defaultValue={purchase.actual_cost ?? ''}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                onUpdateActualCost(purchase.id, isNaN(val) ? null : val);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 w-36 text-sm"
                              defaultValue={purchase.planned_purchase_date || ''}
                              onBlur={(e) => {
                                onUpdateField(purchase.id, 'planned_purchase_date', e.target.value || null);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 w-36 text-sm"
                              defaultValue={(purchase as any).start_date || ''}
                              onBlur={(e) => {
                                onUpdateField(purchase.id, 'start_date', e.target.value || null);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 w-36 text-sm"
                              defaultValue={(purchase as any).end_date || ''}
                              onBlur={(e) => {
                                onUpdateField(purchase.id, 'end_date', e.target.value || null);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-36 text-sm"
                              placeholder="Fornecedor"
                              defaultValue={purchase.supplier_name || ''}
                              onBlur={(e) => {
                                onUpdateField(purchase.id, 'supplier_name', e.target.value || null);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={purchase.status} onValueChange={(v) => onStatusChange(purchase.id, v as PurchaseStatus)}>
                              <SelectTrigger className={cn('h-8 w-32', config.color)}>
                                <div className="flex items-center gap-1.5">
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  <span className="text-xs">{config.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([key, c]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <c.icon className="h-4 w-4" />
                                      {c.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <ContractCell purchase={purchase} onUpdateField={onUpdateField} />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => setFlowModal({ purchase })}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                              Fluxo
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn('h-8 w-8', purchase.notes && 'text-primary')}
                              onClick={() => setObsModal({ purchase })}
                              aria-label="Observações"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
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
    </>
  );
}
