import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ObraTaskInput, ObraTask } from '@/hooks/useObraTasks';
import { useStaffUsers } from '@/hooks/useStaffUsers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ObraTaskInput) => void;
  initialData?: ObraTask | null;
}

export function AtividadeFormDialog({ open, onOpenChange, onSubmit, initialData }: Props) {
  const { data: staffUsers = [] } = useStaffUsers();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [responsibleUserId, setResponsibleUserId] = useState(initialData?.responsible_user_id || '');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [cost, setCost] = useState(initialData?.cost?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description || null,
      responsible_user_id: responsibleUserId || null,
      due_date: dueDate || null,
      cost: cost ? parseFloat(cost) : null,
    });
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResponsibleUserId('');
    setDueDate('');
    setCost('');
  };

  // Reset when dialog opens with initial data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setResponsibleUserId(initialData.responsible_user_id || '');
      setDueDate(initialData.due_date || '');
      setCost(initialData.cost?.toString() || '');
    } else if (!isOpen) {
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
            <Label htmlFor="title">Ação *</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Comprar material elétrico" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsible">Responsável</Label>
            <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome} ({u.perfil})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Prazo</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Custo (R$)</Label>
              <Input id="cost" type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da atividade..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!title.trim()}>
              {initialData ? 'Salvar' : 'Criar Atividade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
