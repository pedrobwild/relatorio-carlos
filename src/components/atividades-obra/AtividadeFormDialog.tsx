import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ObraTaskInput, ObraTask, ObraTaskPriority } from '@/hooks/useObraTasks';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useDialogDraft } from '@/hooks/useDialogDraft';
import { AutosaveIndicator } from '@/components/ui/AutosaveIndicator';
import { toast } from 'sonner';
import { trackAmplitude } from '@/lib/amplitude';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ObraTaskInput) => void;
  initialData?: ObraTask | null;
  /**
   * Optional scope to differentiate drafts across pages/projects (e.g. projectId).
   * Falls back to "global" when not provided.
   */
  draftScope?: string;
}

const priorities: { value: ObraTaskPriority; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

interface AtividadeDraft {
  title: string;
  description: string;
  responsibleUserId: string;
  dueDate: string;
  startDate: string;
  cost: string;
  priority: ObraTaskPriority;
}

export function AtividadeFormDialog({ open, onOpenChange, onSubmit, initialData, draftScope }: Props) {
  const { data: staffUsers = [] } = useStaffUsers();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [responsibleUserId, setResponsibleUserId] = useState(initialData?.responsible_user_id || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [startDate, setStartDate] = useState(initialData?.start_date || '');
  const [cost, setCost] = useState(initialData?.cost?.toString() || '');
  const [priority, setPriority] = useState<ObraTaskPriority>(initialData?.priority || 'media');

  // Autosave draft (per scope + new/editing target)
  const draftKey = `atividade-${draftScope || 'global'}-${initialData?.id || 'new'}`;
  const { restored, clearDraft, lastSavedAt } = useDialogDraft<AtividadeDraft>({
    key: draftKey,
    enabled: open,
    values: { title, description, responsibleUserId, dueDate, startDate, cost, priority },
    isDirty: (v) =>
      !!(v.title.trim() || v.description.trim() || v.responsibleUserId || v.dueDate || v.startDate || v.cost),
    onRestore: (draft) => {
      if (draft.title !== undefined) setTitle(draft.title);
      if (draft.description !== undefined) setDescription(draft.description);
      if (draft.responsibleUserId !== undefined) setResponsibleUserId(draft.responsibleUserId);
      if (draft.dueDate !== undefined) setDueDate(draft.dueDate);
      if (draft.startDate !== undefined) setStartDate(draft.startDate);
      if (draft.cost !== undefined) setCost(draft.cost);
      if (draft.priority !== undefined) setPriority(draft.priority);
    },
  });

  // Notify the user once when a draft is restored
  useEffect(() => {
    if (restored) {
      toast.info('Rascunho restaurado', {
        description: 'Recuperamos as informações que você havia preenchido.',
        duration: 4000,
      });
    }
  }, [restored]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const isEdit = !!initialData?.id;
    onSubmit({
      title: title.trim(),
      description: description || null,
      responsible_user_id: (responsibleUserId && responsibleUserId !== 'none') ? responsibleUserId : null,
      due_date: dueDate || null,
      start_date: startDate || null,
      cost: cost ? parseFloat(cost) : null,
      priority,
    });
    trackAmplitude('Activity Saved', {
      mode: isEdit ? 'update' : 'create',
      activity_id: initialData?.id ?? null,
      project_scope: draftScope ?? null,
      priority,
      has_responsible: !!(responsibleUserId && responsibleUserId !== 'none'),
      has_due_date: !!dueDate,
    });
    clearDraft();
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResponsibleUserId('');
    setDueDate('');
    setStartDate('');
    setCost('');
    setPriority('media');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setResponsibleUserId(initialData.responsible_user_id || '');
      setDueDate(initialData.due_date || '');
      setStartDate(initialData.start_date || '');
      setCost(initialData.cost?.toString() || '');
      setPriority(initialData.priority || 'media');
    } else if (!isOpen) {
      // Keep the draft on close (so accidental close doesn't lose data).
      // Only reset the local UI state.
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título da atividade *</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Comprar material elétrico" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável</Label>
              <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {staffUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} ({u.perfil})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ObraTaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data início</Label>
              <Input id="start_date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Prazo</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Custo (R$)</Label>
            <Input id="cost" type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da atividade..." rows={3} />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <AutosaveIndicator lastSavedAt={lastSavedAt} className="self-center" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={!title.trim()}>
                {initialData ? 'Salvar' : 'Criar Atividade'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
