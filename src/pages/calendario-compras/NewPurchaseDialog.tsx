/**
 * Modal para criar uma nova solicitação de compra a partir do Calendário.
 *
 * Validações claras (campo a campo) e fallback de prazo: quando o usuário
 * não informa data planejada, usa hoje + 7 dias para `required_by_date`
 * (NOT NULL no banco).
 */
import { useEffect, useState } from 'react';
import { addDays, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { ProjectPurchaseInsert } from './types';

interface NewPurchaseForm {
  project_id: string;
  item_name: string;
  category: string;
  supplier_name: string;
  estimated_cost: string;
  planned_purchase_date: Date | undefined;
  quantity: string;
  unit: string;
  description: string;
  notes: string;
}

const EMPTY_FORM: NewPurchaseForm = {
  project_id: '',
  item_name: '',
  category: '',
  supplier_name: '',
  estimated_cost: '',
  planned_purchase_date: undefined,
  quantity: '',
  unit: '',
  description: '',
  notes: '',
};

interface NewPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

export function NewPurchaseDialog({ open, onClose, projects, onCreated }: NewPurchaseDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<NewPurchaseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  const set = (field: keyof NewPurchaseForm, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    const missing: string[] = [];
    if (!form.project_id) missing.push('Obra');
    if (!form.item_name.trim()) missing.push('Nome do item');

    if (missing.length > 1) {
      toast.error('Campos obrigatórios não preenchidos', {
        description: `Preencha: ${missing.join(', ')}.`,
      });
      return;
    }
    if (missing.length === 1) {
      const map: Record<string, { title: string; desc: string }> = {
        Obra: {
          title: 'Selecione uma obra',
          desc: 'Escolha a obra para a qual esta compra será solicitada.',
        },
        'Nome do item': {
          title: 'Informe o nome do item',
          desc: 'Descreva brevemente o que está sendo solicitado (ex: Cimento CP-II 50kg).',
        },
      };
      const m = map[missing[0]];
      toast.error(m.title, { description: m.desc });
      return;
    }

    if (!user?.id) {
      toast.error('Sessão expirada', {
        description: 'Não foi possível identificar seu usuário. Faça login novamente para continuar.',
      });
      return;
    }

    setSaving(true);
    try {
      const planned = form.planned_purchase_date;
      const plannedValid = planned instanceof Date && isValid(planned);
      const plannedDate = plannedValid ? format(planned, 'yyyy-MM-dd') : null;
      const requiredDate = plannedValid
        ? format(planned, 'yyyy-MM-dd')
        : format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const payload: ProjectPurchaseInsert = {
        project_id: form.project_id,
        created_by: user.id,
        item_name: form.item_name.trim(),
        category: form.category.trim() || null,
        supplier_name: form.supplier_name.trim() || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost.replace(',', '.')) : null,
        planned_purchase_date: plannedDate,
        required_by_date: requiredDate,
        quantity: form.quantity ? Number(form.quantity) : 1,
        unit: form.unit.trim() || 'un',
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: 'pending',
      };
      const { error } = await supabase.from('project_purchases').insert(payload);
      if (error) throw error;
      toast.success('Solicitação criada com sucesso!', {
        description: `${form.item_name.trim()} foi adicionada ao calendário de compras.`,
      });
      onCreated();
      onClose();
    } catch (e) {
      console.error('[CalendarioCompras] insert error:', e);
      const message = e instanceof Error ? e.message : 'Erro desconhecido';
      toast.error('Não foi possível criar a solicitação', {
        description: `${message}. Tente novamente em alguns instantes.`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Solicitação de Compra
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">
              Obra <span className="text-destructive">*</span>
            </Label>
            <Select value={form.project_id} onValueChange={(v) => set('project_id', v)}>
              <SelectTrigger className={cn('h-9', !form.project_id && 'border-destructive/50')}>
                <SelectValue placeholder="Selecionar obra…" />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">
              Item / Produto <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Cimento CP-II, Vergalhão 10mm…"
              value={form.item_name}
              onChange={(e) => set('item_name', e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">Categoria</Label>
              <Input
                placeholder="Ex: Estrutura, Elétrico…"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Fornecedor</Label>
              <Input
                placeholder="Nome do fornecedor"
                value={form.supplier_name}
                onChange={(e) => set('supplier_name', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">Quantidade</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Unidade</Label>
              <Input
                placeholder="un, kg, m²…"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Custo Estimado (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.estimated_cost}
                onChange={(e) => set('estimated_cost', e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm">Data Planejada de Compra</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-9 justify-start font-normal text-sm',
                    !form.planned_purchase_date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.planned_purchase_date
                    ? format(form.planned_purchase_date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Selecionar data…'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[300]" align="start">
                <CalendarPicker
                  mode="single"
                  selected={form.planned_purchase_date}
                  onSelect={(d) => {
                    set('planned_purchase_date', d);
                    setDateOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sm">Descrição técnica</Label>
            <Textarea
              placeholder="Especificações, normas, referências técnicas…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-sm">Observações</Label>
            <Textarea
              placeholder="Urgência, ponto de entrega, contato do fornecedor…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? (
              'Salvando…'
            ) : (
              <>
                <Plus className="h-4 w-4" /> Criar Solicitação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
