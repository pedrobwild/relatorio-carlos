import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCreateNonConformity, type NcSeverity } from '@/hooks/useNonConformities';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { cn } from '@/lib/utils';
import { NC_CATEGORIES, parseCurrencyInput } from './ncConstants';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';

const severityOptions: { value: NcSeverity; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  inspectionId?: string;
  inspectionItemId?: string;
  prefillTitle?: string;
  onSuccess?: () => void;
}

export function CreateNcDialog({
  open,
  onOpenChange,
  projectId,
  inspectionId,
  inspectionItemId,
  prefillTitle,
  onSuccess,
}: Props) {
  const createNc = useCreateNonConformity();
  const { members } = useProjectMembers(projectId);

  const [title, setTitle] = useState(prefillTitle || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [severity, setSeverity] = useState<NcSeverity>('high');
  const [responsibleUserId, setResponsibleUserId] = useState<string>('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [estimatedCostInput, setEstimatedCostInput] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(prefillTitle || '');
      setDescription('');
      setCategory('');
      setSeverity('high');
      setResponsibleUserId('');
      setDeadline(undefined);
      setEstimatedCostInput('');
    }
  }, [open, prefillTitle]);

  const handleSubmit = () => {
    if (!title.trim() || !category) return;
    const estimatedCost = parseCurrencyInput(estimatedCostInput);

    createNc.mutate(
      {
        project_id: projectId,
        inspection_id: inspectionId,
        inspection_item_id: inspectionItemId,
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        category,
        estimated_cost: estimatedCost ?? undefined,
        responsible_user_id: responsibleUserId || undefined,
        deadline: deadline ? format(deadline, 'yyyy-MM-dd') : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  const staffMembers = members.filter(m => m.role !== 'viewer' && m.role !== 'customer');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Registrar Não Conformidade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-title" className="text-sm font-medium">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descreva a não conformidade..."
              className="h-11"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="nc-description" className="text-sm font-medium">
              Descrição
            </Label>
            <Textarea
              id="nc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              className="min-h-[44px]"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Categoria <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecionar categoria..." />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                {NC_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="min-h-[44px]">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severidade */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Severidade <span className="text-destructive">*</span>
            </Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as NcSeverity)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                {severityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="min-h-[44px]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Responsável</Label>
            <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecionar responsável..." />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                {staffMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id} className="min-h-[44px]">
                    {m.user_name || m.user_email || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Prazo</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full h-11 justify-start text-left font-normal',
                    !deadline && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar prazo...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Custo Estimado */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Custo Estimado (R$)</Label>
            <Input
              value={estimatedCostInput}
              onChange={(e) => setEstimatedCostInput(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !category || createNc.isPending}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {createNc.isPending ? 'Criando...' : 'Registrar NC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
