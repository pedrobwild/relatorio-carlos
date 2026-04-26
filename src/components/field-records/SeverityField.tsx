/**
 * Select tipado para severidade de um Field Record.
 *
 * Quatro níveis: low / medium / high / critical. Mostra um dot colorido
 * (semantic tones) ao lado do label. Wrapper fino sobre `<Select>` —
 * existe pra padronizar labels e cores em todos os 3 kinds (NC, Vistoria,
 * Atividade).
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SEVERITY_LABEL, type FieldRecordSeverity } from './types';

const DOT_BY_SEVERITY: Record<FieldRecordSeverity, string> = {
  low: 'bg-muted-foreground/60',
  medium: 'bg-info',
  high: 'bg-warning',
  critical: 'bg-destructive',
};

interface SeverityFieldProps {
  value: FieldRecordSeverity;
  onChange: (severity: FieldRecordSeverity) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export function SeverityField({
  value,
  onChange,
  label = 'Severidade',
  required,
  className,
}: SeverityFieldProps) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as FieldRecordSeverity)}>
        <SelectTrigger className="h-9 mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SEVERITY_LABEL) as FieldRecordSeverity[]).map((sev) => (
            <SelectItem key={sev} value={sev}>
              <span className="flex items-center gap-2">
                <span className={cn('h-1.5 w-1.5 rounded-full', DOT_BY_SEVERITY[sev])} />
                {SEVERITY_LABEL[sev]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
