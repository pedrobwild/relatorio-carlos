/**
 * Dialog unificado para registrar/editar um "Field Record" (evento de campo).
 *
 * Compõe os primitivos (`SeverityField`, `AssigneeField`, `LocationField`,
 * `MediaUploader`) num scaffold padrão (header + 2 colunas em desktop +
 * footer) que serve a NC, Vistoria e Atividade. Cada `kind` injeta seus
 * campos específicos via `extraFields` e configura quais campos comuns
 * mostrar via `enabledFields`.
 *
 * Não persiste dados — quem persiste é o consumidor, que recebe o
 * `FieldRecordValues` via `onSubmit`. Isso mantém o dialog reusável entre
 * tabelas Supabase distintas (non_conformities, inspections, ...).
 */
import { useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AssigneeField } from './AssigneeField';
import { LocationField } from './LocationField';
import { MediaUploader } from './MediaUploader';
import { SeverityField } from './SeverityField';
import {
  FIELD_RECORD_KIND_LABEL,
  type FieldRecordKind,
  type FieldRecordLocation,
  type FieldRecordMedia,
  type FieldRecordSeverity,
} from './types';

export interface FieldRecordValues {
  title: string;
  description: string;
  date: string | null; // YYYY-MM-DD
  severity: FieldRecordSeverity;
  assigneeId: string | null;
  location: FieldRecordLocation | null;
  media: FieldRecordMedia[];
}

export interface FieldRecordEnabledFields {
  description?: boolean;
  date?: boolean;
  severity?: boolean;
  assignee?: boolean;
  location?: boolean;
  media?: boolean;
}

const DEFAULT_ENABLED: Required<FieldRecordEnabledFields> = {
  description: true,
  date: true,
  severity: true,
  assignee: true,
  location: true,
  media: true,
};

interface FieldRecordDialogProps {
  kind: FieldRecordKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  values: FieldRecordValues;
  onChange: (values: FieldRecordValues) => void;

  /** Override de quais campos comuns aparecem. Default: todos. */
  enabledFields?: FieldRecordEnabledFields;

  /** Slot pra campos específicos do kind (categoria NC, template vistoria, ...). */
  extraFields?: ReactNode;

  /** Conteúdo extra dentro do header (ex.: chip indicando draft restaurado). */
  headerExtras?: ReactNode;

  /** Texto do botão primário. Default "Registrar". */
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (values: FieldRecordValues) => void | Promise<void>;

  /** Override do título. Default: rótulo do kind ("Não conformidade"...). */
  title?: string;

  /** Texto da descrição (subtítulo). */
  description?: string;

  /** Lista custom para AssigneeField (default: useStaffUsers). */
  assigneeUsers?: { id: string; name: string; hint?: string }[];
}

const dateToISO = (d: Date | undefined): string | null =>
  d ? format(d, 'yyyy-MM-dd') : null;

export function FieldRecordDialog({
  kind,
  open,
  onOpenChange,
  values,
  onChange,
  enabledFields,
  extraFields,
  headerExtras,
  submitLabel = 'Registrar',
  submitting,
  onSubmit,
  title,
  description,
  assigneeUsers,
}: FieldRecordDialogProps) {
  const enabled = { ...DEFAULT_ENABLED, ...enabledFields };
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const set = <K extends keyof FieldRecordValues>(key: K, value: FieldRecordValues[K]) =>
    onChange({ ...values, [key]: value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    void onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title ?? `Registrar ${FIELD_RECORD_KIND_LABEL[kind].toLowerCase()}`}
            {headerExtras}
          </DialogTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Título */}
          <div>
            <Label htmlFor="field-record-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-record-title"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              required
              className="mt-1"
              placeholder="Resumo curto do evento"
            />
          </div>

          {/* Descrição */}
          {enabled.description && (
            <div>
              <Label htmlFor="field-record-desc" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Descrição
              </Label>
              <Textarea
                id="field-record-desc"
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Detalhe o que foi observado…"
                rows={3}
                className="mt-1"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data */}
            {enabled.date && (
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Data
                </Label>
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'mt-1 w-full justify-start text-left font-normal h-9',
                        !values.date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {values.date
                        ? format(new Date(values.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={values.date ? new Date(values.date + 'T00:00:00') : undefined}
                      onSelect={(d) => {
                        set('date', dateToISO(d));
                        setDatePopoverOpen(false);
                      }}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Severidade */}
            {enabled.severity && (
              <SeverityField
                value={values.severity}
                onChange={(s) => set('severity', s)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Responsável */}
            {enabled.assignee && (
              <AssigneeField
                value={values.assigneeId}
                onChange={(id) => set('assigneeId', id)}
                users={assigneeUsers}
              />
            )}

            {/* Localização */}
            {enabled.location && (
              <LocationField
                value={values.location}
                onChange={(loc) => set('location', loc)}
              />
            )}
          </div>

          {/* Mídia */}
          {enabled.media && (
            <MediaUploader
              files={values.media}
              onChange={(media) => set('media', media)}
            />
          )}

          {/* Slot por kind */}
          {extraFields}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !values.title.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
