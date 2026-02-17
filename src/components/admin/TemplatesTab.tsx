import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectTemplates,
  useCreateProjectTemplate,
  useUpdateProjectTemplate,
  useDeleteProjectTemplate,
  type ProjectTemplate,
} from '@/hooks/useProjectTemplates';
import { activityTemplateSets, type ActivityTemplateSet } from '@/data/activityTemplates';

interface FormState {
  name: string;
  description: string;
  is_project_phase: boolean;
  default_contract_value: string;
  selected_activity_template: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  is_project_phase: false,
  default_contract_value: '',
  selected_activity_template: '',
};

export function TemplatesTab() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useProjectTemplates();
  const createTemplate = useCreateProjectTemplate();
  const updateTemplate = useUpdateProjectTemplate();
  const deleteTemplate = useDeleteProjectTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: ProjectTemplate) => {
    setEditingId(t.id);
    const actMatch = activityTemplateSets.find(
      (a) => JSON.stringify(a.activities) === JSON.stringify(t.default_activities)
    );
    setForm({
      name: t.name,
      description: t.description ?? '',
      is_project_phase: t.is_project_phase,
      default_contract_value: t.default_contract_value?.toString() ?? '',
      selected_activity_template: actMatch?.id ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const actTemplate = activityTemplateSets.find((a) => a.id === form.selected_activity_template);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      is_project_phase: form.is_project_phase,
      default_activities: actTemplate?.activities ?? [],
      default_contract_value: form.default_contract_value ? parseFloat(form.default_contract_value) : null,
    };

    try {
      if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, ...payload });
        toast({ title: 'Template atualizado' });
      } else {
        await createTemplate.mutateAsync(payload);
        toast({ title: 'Template criado' });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: 'Template excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const handleDuplicate = (t: ProjectTemplate) => {
    setEditingId(null);
    const actMatch = activityTemplateSets.find(
      (a) => JSON.stringify(a.activities) === JSON.stringify(t.default_activities)
    );
    setForm({
      name: `${t.name} (cópia)`,
      description: t.description ?? '',
      is_project_phase: t.is_project_phase,
      default_contract_value: t.default_contract_value?.toString() ?? '',
      selected_activity_template: actMatch?.id ?? '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 font-bold">Templates de Obra</h2>
          <p className="text-sm text-muted-foreground">
            Crie templates reutilizáveis para agilizar o cadastro de novas obras
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5 space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !templates?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Nenhum template criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Templates ajudam a padronizar o cadastro de obras
            </p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="group hover:border-primary/50 transition-colors">
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
                  {t.default_activities?.length > 0 && (
                    <Badge variant="outline">
                      {t.default_activities.length} atividades
                    </Badge>
                  )}
                  {t.default_contract_value && (
                    <Badge variant="outline">
                      R$ {Number(t.default_contract_value).toLocaleString('pt-BR')}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-8 gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(t)} className="h-8 gap-1">
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
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
                        <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nome *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Reforma Studio Padrão"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Textarea
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva quando usar este template..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="tpl-phase" className="text-sm font-medium">Fase de projeto</Label>
                <p className="text-xs text-muted-foreground">Obra em fase de aprovação</p>
              </div>
              <Switch
                id="tpl-phase"
                checked={form.is_project_phase}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_project_phase: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-value">Valor padrão do contrato (R$)</Label>
              <Input
                id="tpl-value"
                type="number"
                step="0.01"
                value={form.default_contract_value}
                onChange={(e) => setForm((p) => ({ ...p, default_contract_value: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label>Cronograma padrão</Label>
              <div className="grid gap-2">
                {activityTemplateSets.map((at) => (
                  <label
                    key={at.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      form.selected_activity_template === at.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity-template"
                      value={at.id}
                      checked={form.selected_activity_template === at.id}
                      onChange={() => setForm((p) => ({ ...p, selected_activity_template: at.id }))}
                      className="sr-only"
                    />
                    <span className="text-xl">{at.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{at.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{at.description}</p>
                    </div>
                    {form.selected_activity_template === at.id && (
                      <Badge variant="default" className="shrink-0">Selecionado</Badge>
                    )}
                  </label>
                ))}
                <label
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    form.selected_activity_template === ''
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="activity-template"
                    value=""
                    checked={form.selected_activity_template === ''}
                    onChange={() => setForm((p) => ({ ...p, selected_activity_template: '' }))}
                    className="sr-only"
                  />
                  <span className="text-xl">📋</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Nenhum (cronograma vazio)</p>
                    <p className="text-xs text-muted-foreground">Sem atividades pré-definidas</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createTemplate.isPending || updateTemplate.isPending}
            >
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
