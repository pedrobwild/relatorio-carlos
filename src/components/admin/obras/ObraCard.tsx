import { User, Calendar, Eye, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { ProjectWithCustomer } from '@/infra/repositories';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/activityStatus';
import { statusColors, statusLabels } from './obraCardUtils';

interface ObraCardProps {
  project: ProjectWithCustomer;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ObraCard({ project, onView, onEdit, onDelete }: ObraCardProps) {
  // TODO: Use daysRemaining for deadline indicators in the card UI
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{project.name}</p>
            {project.unit_name && (
              <p className="text-sm text-muted-foreground truncate">{project.unit_name}</p>
            )}
            {project.customer_name && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <User className="h-3 w-3" /> {project.customer_name}
              </p>
            )}
            {project.planned_start_date && project.planned_end_date && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(parseLocalDate(project.planned_start_date), 'dd/MM/yy', { locale: ptBR })} -{' '}
                  {format(parseLocalDate(project.planned_end_date), 'dd/MM/yy', { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11" onClick={onView}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11" onClick={onEdit}>
                <Settings className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] h-11 w-11 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mover obra para a lixeira?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A obra <strong>{project.name}</strong> deixará de aparecer nas listas, mas todos os dados associados serão preservados e poderão ser restaurados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Mover para lixeira
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
