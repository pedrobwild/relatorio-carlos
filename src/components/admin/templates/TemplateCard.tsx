import { Pencil, Trash2, Copy, Eye, Download, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { ProjectTemplate } from '@/hooks/useProjectTemplates';
import { type ActivityItem, totalDays, getCategoryLabel } from './types';

interface TemplateCardProps {
  template: ProjectTemplate;
  onPreview: (t: ProjectTemplate) => void;
  onEdit: (t: ProjectTemplate) => void;
  onDuplicate: (t: ProjectTemplate) => void;
  onExport: (t: ProjectTemplate) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({ template: t, onPreview, onEdit, onDuplicate, onExport, onDelete }: TemplateCardProps) {
  const acts = (t.default_activities ?? []) as ActivityItem[];

  return (
    <Card className="group hover:border-primary/50 transition-colors">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-semibold truncate">{t.name}</h3>
            {t.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">
            {t.is_project_phase ? 'Fase Projeto' : 'Execução'}
          </Badge>
          {t.category && t.category !== 'geral' && (
            <Badge variant="outline" className="gap-1">
              <Tag className="h-3 w-3" />
              {getCategoryLabel(t.category)}
            </Badge>
          )}
          {acts.length > 0 && (
            <Badge variant="outline">
              {acts.length} atividades · {totalDays(acts)}d
            </Badge>
          )}
          {(t.usage_count ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              {t.usage_count}× usado
            </Badge>
          )}
          {t.default_contract_value && (
            <Badge variant="outline">
              R$ {Number(t.default_contract_value).toLocaleString('pt-BR')}
            </Badge>
          )}
        </div>

        <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => onPreview(t)} className="h-8 gap-1">
            <Eye className="h-3.5 w-3.5" /> Ver
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(t)} className="h-8 gap-1">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(t)} className="h-8 gap-1">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onExport(t)} className="h-8 gap-1">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita. O template "{t.name}" será removido permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
