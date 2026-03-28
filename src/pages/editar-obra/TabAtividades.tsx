import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Activity } from './types';

interface TabAtividadesProps {
  activities: Activity[];
  onAdd: (a: { description: string; planned_start: string; planned_end: string; weight: string }) => Promise<boolean>;
  onUpdate: (id: string, field: string, value: string | number | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TabAtividades({ activities, onAdd, onUpdate, onDelete }: TabAtividadesProps) {
  const [newActivity, setNewActivity] = useState({ description: '', planned_start: '', planned_end: '', weight: '5' });

  const handleAdd = async () => {
    const ok = await onAdd(newActivity);
    if (ok) setNewActivity({ description: '', planned_start: '', planned_end: '', weight: '5' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cronograma de Atividades</CardTitle>
          <CardDescription>{activities.length} atividades cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add form */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input placeholder="Nome da atividade" value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={newActivity.planned_start} onChange={(e) => setNewActivity({ ...newActivity, planned_start: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Término</Label>
              <Input type="date" value={newActivity.planned_end} onChange={(e) => setNewActivity({ ...newActivity, planned_end: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {activities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Início Prev.</TableHead>
                  <TableHead>Término Prev.</TableHead>
                  <TableHead className="w-16">Peso</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{a.sort_order}</TableCell>
                    <TableCell><Input value={a.description} onChange={(e) => onUpdate(a.id, 'description', e.target.value)} className="h-8" /></TableCell>
                    <TableCell><Input type="date" value={a.planned_start} onChange={(e) => onUpdate(a.id, 'planned_start', e.target.value)} className="h-8 w-32" /></TableCell>
                    <TableCell><Input type="date" value={a.planned_end} onChange={(e) => onUpdate(a.id, 'planned_end', e.target.value)} className="h-8 w-32" /></TableCell>
                    <TableCell><Input type="number" min="1" max="100" value={a.weight} onChange={(e) => onUpdate(a.id, 'weight', parseFloat(e.target.value))} className="h-8 w-16" /></TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover atividade?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(a.id)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhuma atividade cadastrada. Adicione a primeira acima.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
