import { useState } from 'react';
import { Plus, Trash2, GripVertical, Calendar, Weight, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Activity } from './types';

interface TabAtividadesProps {
  activities: Activity[];
  onAdd: (a: { description: string; planned_start: string; planned_end: string; weight: string }) => Promise<boolean>;
  onUpdate: (id: string, field: string, value: string | number | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function WeightBar({ total }: { total: number }) {
  const isValid = total === 100;
  const isOver = total > 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Peso total</span>
        <span className={cn(
          'font-bold tabular-nums',
          isValid ? 'text-[hsl(var(--success))]' : isOver ? 'text-destructive' : 'text-[hsl(var(--warning))]'
        )}>
          {total}%
        </span>
      </div>
      <Progress
        value={Math.min(total, 100)}
        className={cn(
          'h-2 rounded-full',
          isValid ? '[&>div]:bg-[hsl(var(--success))]' : isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-[hsl(var(--warning))]'
        )}
      />
      {!isValid && (
        <p className={cn(
          'text-[11px]',
          isOver ? 'text-destructive' : 'text-[hsl(var(--warning))]'
        )}>
          {isOver ? `${total - 100}% acima do total` : `Faltam ${100 - total}% para completar`}
        </p>
      )}
    </div>
  );
}

function AddActivityForm({ onAdd }: { onAdd: TabAtividadesProps['onAdd'] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ description: '', planned_start: '', planned_end: '', weight: '5' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    const ok = await onAdd(form);
    if (ok) {
      setForm({ description: '', planned_start: '', planned_end: '', weight: '5' });
      // keep open for rapid entry
    }
    setAdding(false);
  };

  const canSubmit = form.description && form.planned_start && form.planned_end;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant={isOpen ? 'secondary' : 'outline'} className="w-full h-12 gap-2 border-dashed text-sm">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isOpen ? 'Fechar formulário' : 'Adicionar atividade'}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-accent/30 p-4 md:p-5 space-y-4 animate-fade-in">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Descrição da atividade</Label>
            <Input
              placeholder="Ex: Pintura 1ª demão, Instalação piso porcelanato..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-11"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Início previsto
              </Label>
              <Input
                type="date"
                value={form.planned_start}
                onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Término previsto
              </Label>
              <Input
                type="date"
                value={form.planned_end}
                onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Weight className="h-3 w-3 text-muted-foreground" />
                Peso (%)
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="h-11"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-10" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-10 gap-1.5" onClick={handleAdd} disabled={!canSubmit || adding}>
              {adding ? (
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActivityCard({
  activity,
  index,
  onUpdate,
  onDelete,
}: {
  activity: Activity;
  index: number;
  onUpdate: TabAtividadesProps['onUpdate'];
  onDelete: TabAtividadesProps['onDelete'];
}) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const durationDays = (() => {
    if (!activity.planned_start || !activity.planned_end) return null;
    const start = new Date(activity.planned_start);
    const end = new Date(activity.planned_end);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  })();

  return (
    <div className={cn(
      'group rounded-xl border bg-card transition-all duration-200',
      expanded ? 'border-primary/30 shadow-sm' : 'border-border/60 hover:border-border',
    )}>
      {/* Summary row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3.5 md:p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
            {index + 1}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{activity.description || 'Sem descrição'}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            {activity.planned_start && activity.planned_end && (
              <span>{formatDate(activity.planned_start)} → {formatDate(activity.planned_end)}</span>
            )}
            {durationDays && (
              <span className="text-muted-foreground/60">· {durationDays}d</span>
            )}
          </div>
        </div>

        <Badge variant="secondary" className="shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5">
          {activity.weight}%
        </Badge>

        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground/60 transition-transform shrink-0',
          expanded && 'rotate-180'
        )} />
      </button>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-3.5 pb-4 md:px-4 space-y-3 animate-fade-in border-t border-border/40 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input
              value={activity.description}
              onChange={(e) => onUpdate(activity.id, 'description', e.target.value)}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Início Prev.</Label>
              <Input
                type="date"
                value={activity.planned_start}
                onChange={(e) => onUpdate(activity.id, 'planned_start', e.target.value)}
                className="h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Término Prev.</Label>
              <Input
                type="date"
                value={activity.planned_end}
                onChange={(e) => onUpdate(activity.id, 'planned_end', e.target.value)}
                className="h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Início Real</Label>
              <Input
                type="date"
                value={activity.actual_start || ''}
                onChange={(e) => onUpdate(activity.id, 'actual_start', e.target.value || null)}
                className="h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Término Real</Label>
              <Input
                type="date"
                value={activity.actual_end || ''}
                onChange={(e) => onUpdate(activity.id, 'actual_end', e.target.value || null)}
                className="h-10 text-xs"
              />
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 pt-1">
            <div className="w-24 space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Peso (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={activity.weight}
                onChange={(e) => onUpdate(activity.id, 'weight', parseFloat(e.target.value) || 0)}
                className="h-10 text-sm font-semibold"
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Remover</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A atividade "{activity.description}" será removida permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(activity.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10 space-y-3">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-accent flex items-center justify-center">
        <ListChecks className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Nenhuma atividade cadastrada</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Adicione atividades ao cronograma para acompanhar o progresso da obra.
        </p>
      </div>
    </div>
  );
}

export function TabAtividades({ activities, onAdd, onUpdate, onDelete }: TabAtividadesProps) {
  const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 0), 0);

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-primary" />
                Cronograma de Atividades
              </CardTitle>
              <CardDescription>
                {activities.length === 0
                  ? 'Monte o cronograma adicionando atividades'
                  : `${activities.length} atividade${activities.length !== 1 ? 's' : ''} cadastrada${activities.length !== 1 ? 's' : ''}`
                }
              </CardDescription>
            </div>
            {activities.length > 0 && (
              <div className="w-40 shrink-0">
                <WeightBar total={totalWeight} />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((a, i) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  index={i}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}

          <AddActivityForm onAdd={onAdd} />
        </CardContent>
      </Card>
    </div>
  );
}
