import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInspection } from '@/hooks/useInspections';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Default checklist items by category
const DEFAULT_ITEMS: Record<string, string[]> = {
  'Alvenaria': [
    'Prumo das paredes verificado',
    'Esquadro das quinas conferido',
    'Nivelamento correto',
    'Argamassa uniforme',
    'Ausência de trincas ou fissuras',
  ],
  'Elétrica': [
    'Pontos de tomada conforme projeto',
    'Fiação identificada e organizada',
    'Disjuntores dimensionados',
    'Aterramento verificado',
    'Conduítes sem obstrução',
  ],
  'Hidráulica': [
    'Pontos de água conforme projeto',
    'Teste de pressão realizado',
    'Esgoto com caimento adequado',
    'Ausência de vazamentos',
    'Registros funcionando',
  ],
  'Acabamento': [
    'Revestimento cerâmico nivelado',
    'Pintura uniforme sem falhas',
    'Rejunte completo e limpo',
    'Soleiras e peitoris instalados',
    'Rodapés alinhados',
  ],
  'Estrutural': [
    'Armadura conforme projeto',
    'Formas alinhadas e niveladas',
    'Escoramento adequado',
    'Concreto sem segregação',
    'Cobrimento mínimo respeitado',
  ],
};

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInspectionDialog({ projectId, open, onOpenChange }: Props) {
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [activityId, setActivityId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [items, setItems] = useState<{ description: string }[]>([]);
  const [newItemText, setNewItemText] = useState('');

  const createInspection = useCreateInspection();

  // Fetch project activities for linking
  const { data: activities = [] } = useQuery({
    queryKey: ['project-activities', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_activities')
        .select('id, description')
        .eq('project_id', projectId)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const handleAddCategory = (category: string) => {
    const categoryItems = DEFAULT_ITEMS[category] || [];
    const newItems = categoryItems
      .filter(desc => !items.some(i => i.description === desc))
      .map(desc => ({ description: desc }));
    setItems(prev => [...prev, ...newItems]);
    setSelectedCategory('');
  };

  const handleAddCustomItem = () => {
    if (!newItemText.trim()) return;
    setItems(prev => [...prev, { description: newItemText.trim() }]);
    setNewItemText('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    createInspection.mutate(
      {
        project_id: projectId,
        activity_id: activityId || undefined,
        inspection_date: inspectionDate,
        notes: notes || undefined,
        items: items.map((item, i) => ({
          description: item.description,
          sort_order: i,
        })),
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Vistoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Data da vistoria</Label>
            <Input
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
            />
          </div>

          {/* Activity link */}
          <div className="space-y-2">
            <Label>Atividade vinculada (opcional)</Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma atividade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {activities.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações gerais da vistoria..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Checklist builder */}
          <div className="space-y-3">
            <Label>Itens do checklist</Label>

            {/* Category presets */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select value={selectedCategory} onValueChange={handleAddCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Adicionar checklist padrão..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(DEFAULT_ITEMS).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom item */}
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar item personalizado..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
              />
              <Button variant="outline" size="icon" onClick={handleAddCustomItem} disabled={!newItemText.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Items list */}
            {items.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{item.description}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleRemoveItem(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'itens'} no checklist
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={items.length === 0 || createInspection.isPending}
          >
            {createInspection.isPending ? 'Criando...' : 'Criar Vistoria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
