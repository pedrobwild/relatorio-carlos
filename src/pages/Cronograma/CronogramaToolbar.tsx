import { Link } from 'react-router-dom';
import { Bookmark, Loader2, Save, ShoppingCart, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIScheduleGenerator } from '@/components/schedule/AIScheduleGenerator';
import { cn } from '@/lib/utils';

interface CronogramaToolbarProps {
  projectId: string | undefined;
  projectName: string | undefined;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  comprasPath: string;
  hasBaseline: boolean;
  saving: boolean;
  savingBaseline: boolean;
  hasActivities: boolean;
  onSaveBaseline: () => void;
  onOpenImport: () => void;
  onSave: () => void;
}

/**
 * Cabeçalho do Cronograma: ações primárias (gerar IA, ir para Compras, baseline,
 * importar, salvar). Renderizado dentro do `<PageHeader>`.
 */
export function CronogramaToolbar({
  projectId,
  projectName,
  plannedStartDate,
  plannedEndDate,
  comprasPath,
  hasBaseline,
  saving,
  savingBaseline,
  hasActivities,
  onSaveBaseline,
  onOpenImport,
  onSave,
}: CronogramaToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <AIScheduleGenerator
        projectId={projectId || ''}
        projectName={projectName || 'Obra'}
        plannedStartDate={plannedStartDate}
        plannedEndDate={plannedEndDate}
      />
      <Link to={comprasPath}>
        <Button variant="outline" size="sm" className="text-xs">
          <ShoppingCart className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Compras</span>
        </Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={onSaveBaseline}
        disabled={savingBaseline || !hasActivities}
      >
        {savingBaseline ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Bookmark className={cn('w-4 h-4 mr-1.5', hasBaseline && 'fill-current')} />
        )}
        <span className="hidden sm:inline">
          {hasBaseline ? 'Atualizar Baseline' : 'Baseline'}
        </span>
      </Button>
      <Button variant="outline" size="sm" className="text-xs" onClick={onOpenImport}>
        <Upload className="w-4 h-4 mr-1.5" />
        <span className="hidden sm:inline">Importar</span>
      </Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-1.5" />
        )}
        Salvar
      </Button>
    </div>
  );
}
