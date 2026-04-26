/**
 * Barra de filtros: obra, etapa do cronograma e toggle "incluir obras concluídas".
 */
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProjectOption {
  id: string;
  name: string;
  client_name?: string | null;
  isCompleted: boolean;
}

interface CalendarObrasFiltersProps {
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  projectOptions: ProjectOption[];
  visibleProjectCount: number;

  etapaFilter: string;
  onEtapaFilterChange: (value: string) => void;
  etapaOptions: { list: string[]; hasEmpty: boolean };

  includeCompleted: boolean;
  onIncludeCompletedChange: (next: boolean) => void;
  hiddenCompletedCount: number;
}

export function CalendarObrasFilters({
  projectFilter,
  onProjectFilterChange,
  projectOptions,
  visibleProjectCount,
  etapaFilter,
  onEtapaFilterChange,
  etapaOptions,
  includeCompleted,
  onIncludeCompletedChange,
  hiddenCompletedCount,
}: CalendarObrasFiltersProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtrar por obra:
        </div>
        <Select value={projectFilter} onValueChange={onProjectFilterChange}>
          <SelectTrigger className="h-9 w-full sm:w-[320px]">
            <SelectValue placeholder="Todas as obras" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value="all">Todas as obras ({visibleProjectCount})</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-medium">{p.name}</span>
                {p.client_name && <span className="text-muted-foreground"> · {p.client_name}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {projectFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => onProjectFilterChange('all')} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar filtro
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Etapa:
        </div>
        <Select value={etapaFilter} onValueChange={onEtapaFilterChange}>
          <SelectTrigger className="h-9 w-full sm:w-[220px]">
            <SelectValue placeholder="Todas as etapas" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value="all">
              Todas as etapas ({etapaOptions.list.length + (etapaOptions.hasEmpty ? 1 : 0)})
            </SelectItem>
            {etapaOptions.list.map((etapa) => (
              <SelectItem key={etapa} value={etapa}>
                {etapa}
              </SelectItem>
            ))}
            {etapaOptions.hasEmpty && (
              <SelectItem value="__none__">
                <span className="text-muted-foreground italic">Sem etapa</span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {etapaFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => onEtapaFilterChange('all')} className="h-9">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Switch
          id="include-completed"
          checked={includeCompleted}
          onCheckedChange={onIncludeCompletedChange}
        />
        <Label
          htmlFor="include-completed"
          className="text-xs text-muted-foreground cursor-pointer select-none"
          title="Por padrão, obras com status 'Concluída' ficam ocultas. Ative para mostrá-las novamente."
        >
          Incluir obras concluídas
          {hiddenCompletedCount > 0 && !includeCompleted && (
            <span className="ml-1 text-foreground font-medium">({hiddenCompletedCount})</span>
          )}
        </Label>
      </div>
    </div>
  );
}
