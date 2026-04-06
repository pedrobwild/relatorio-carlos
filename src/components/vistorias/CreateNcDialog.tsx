import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, FileText, ImagePlus, X, Upload, Film } from 'lucide-react';
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
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { cn } from '@/lib/utils';
import { NC_CATEGORIES, parseCurrencyInput } from './ncConstants';
import { useFormDraft } from '@/hooks/useFormDraft';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const severityOptions: { value: NcSeverity; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const ACCEPTED_MEDIA = 'image/*,video/*';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  inspectionId?: string;
  inspectionItemId?: string;
  prefillTitle?: string;
  onSuccess?: () => void;
}

interface MediaPreview {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaPreview[]>([]);
  const [uploading, setUploading] = useState(false);

  const draftKey = `create-nc-${projectId}`;
  const defaultValues = {
    title: prefillTitle || '',
    description: '',
    category: '',
    severity: 'high' as NcSeverity,
    responsibleUserId: '',
    deadline: undefined as string | undefined,
    estimatedCostInput: '',
  };

  const { values: draft, updateField, clearDraft, hasDraft } = useFormDraft({
    key: draftKey,
    initialValues: defaultValues,
  });

  // Reset when dialog opens with prefill (ignore draft for prefill scenarios)
  useEffect(() => {
    if (open && prefillTitle) {
      updateField('title', prefillTitle);
    }
  }, [open, prefillTitle, updateField]);

  // Cleanup media previews on unmount
  useEffect(() => {
    return () => {
      mediaFiles.forEach(m => URL.revokeObjectURL(m.previewUrl));
    };
  }, []);

  // Convenience aliases
  const title = draft.title;
  const description = draft.description;
  const category = draft.category;
  const severity = draft.severity;
  const responsibleUserId = draft.responsibleUserId;
  const deadline = draft.deadline ? new Date(draft.deadline + 'T00:00:00') : undefined;
  const estimatedCostInput = draft.estimatedCostInput;

  const handleAddMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPreviews: MediaPreview[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} excede o limite de 20MB`);
        continue;
      }
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      newPreviews.push({
        file,
        previewUrl: URL.createObjectURL(file),
        type,
      });
    }
    setMediaFiles(prev => [...prev, ...newPreviews]);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadMediaFiles = async (ncId: string): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];
    const paths: string[] = [];

    for (const media of mediaFiles) {
      const safeName = media.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `ncs/${projectId}/${ncId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from('project-documents').upload(path, media.file);
      if (error) {
        console.error('Upload failed:', error);
        continue;
      }
      paths.push(path);
    }
    return paths;
  };

   const handleSubmit = async () => {
    if (!title.trim() || !category) return;
    if (!deadline) {
      toast.error('Informe o prazo para finalização da NC');
      return;
    }
    const estimatedCost = parseCurrencyInput(estimatedCostInput);

    setUploading(true);
    try {
      const nc = await createNc.mutateAsync({
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
      });

      // Upload media and attach to NC
      if (mediaFiles.length > 0 && nc?.id) {
        const paths = await uploadMediaFiles(nc.id);
        if (paths.length > 0) {
          await supabase
            .from('non_conformities')
            .update({ evidence_photos_before: paths })
            .eq('id', nc.id);
        }
      }

      // Cleanup
      mediaFiles.forEach(m => URL.revokeObjectURL(m.previewUrl));
      setMediaFiles([]);
      clearDraft();
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error already toasted by mutation
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    mediaFiles.forEach(m => URL.revokeObjectURL(m.previewUrl));
    setMediaFiles([]);
    clearDraft();
    onOpenChange(false);
  };

  const staffFromProject = members.filter(m => m.role !== 'viewer' && m.role !== 'customer');
  const { data: allStaff = [] } = useStaffUsers();
  
  // Merge: use project members first, add extra staff not already in project
  const extraStaff = allStaff.filter(s => !staffFromProject.some(m => m.user_id === s.id));
  const allResponsibleOptions = [
    ...staffFromProject.map(m => ({ id: m.user_id, name: m.user_name || m.user_email || m.user_id.slice(0, 8) })),
    ...extraStaff.map(s => ({ id: s.id, name: s.nome || s.email })),
  ];
  const isSubmitting = createNc.isPending || uploading;

  // Strip time from today for proper date comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg">Registrar Não Conformidade</DialogTitle>
            {hasDraft && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                Rascunho salvo
              </span>
            )}
          </div>
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
              onChange={(e) => updateField('title', e.target.value)}
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
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              className="min-h-[44px]"
            />
          </div>

          {/* Categoria + Severidade side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={(v) => updateField('category', v)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecionar..." />
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

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Severidade <span className="text-destructive">*</span>
              </Label>
              <Select value={severity} onValueChange={(v) => updateField('severity', v as NcSeverity)}>
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
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Responsável</Label>
            <Select value={responsibleUserId} onValueChange={(v) => updateField('responsibleUserId', v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecionar responsável..." />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                {allResponsibleOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="min-h-[44px]">
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo + Custo side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prazo <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-11 justify-start text-left font-normal',
                      !deadline && 'text-muted-foreground',
                      !deadline && 'border-destructive/50'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {deadline ? format(deadline, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar...'}
                    </span>
                    {deadline && (
                      <X
                        className="ml-auto h-3.5 w-3.5 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateField('deadline', undefined);
                        }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start" sideOffset={4}>
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={(d) => {
                      if (d) {
                        const y = d.getFullYear();
                        const m = (d.getMonth() + 1).toString().padStart(2, '0');
                        const day = d.getDate().toString().padStart(2, '0');
                        updateField('deadline', `${y}-${m}-${day}`);
                      }
                    }}
                    disabled={(date) => {
                      const d = new Date(date);
                      d.setHours(0, 0, 0, 0);
                      return d < today;
                    }}
                    locale={ptBR}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Custo Estimado (R$)</Label>
              <Input
                value={estimatedCostInput}
                onChange={(e) => updateField('estimatedCostInput', e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="h-11"
              />
            </div>
          </div>

          {/* Anexos (Imagem / Vídeo) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Anexos (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MEDIA}
              multiple
              className="hidden"
              onChange={handleAddMedia}
            />

            {mediaFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {mediaFiles.map((media, idx) => (
                  <div key={idx} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                    {media.type === 'image' ? (
                      <img
                        src={media.previewUrl}
                        alt={`Anexo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="h-8 w-8 text-muted-foreground" />
                        <span className="absolute bottom-1 left-1 text-[10px] text-muted-foreground truncate max-w-[90%]">
                          {media.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-10 gap-2 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Adicionar foto ou vídeo
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !category || !deadline || isSubmitting}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {isSubmitting ? 'Criando...' : 'Registrar NC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
