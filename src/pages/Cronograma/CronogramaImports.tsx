import { ImportScheduleModal } from '@/components/ImportScheduleModal';
import type { ActivityFormData as ImportedActivityFormData } from '@/components/import-schedule/types';

interface CronogramaImportsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (activities: ImportedActivityFormData[]) => void;
}

/**
 * Wrapper estreito sobre o ImportScheduleModal — existe só para isolar a
 * dependência do modal de importação dentro da página Cronograma.
 */
export function CronogramaImports({ open, onOpenChange, onImport }: CronogramaImportsProps) {
  return (
    <ImportScheduleModal open={open} onOpenChange={onOpenChange} onImport={onImport} />
  );
}
