import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, FileText, Copy, Search, Eye, X, GripVertical, Download, Upload, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectTemplates,
  useCreateProjectTemplate,
  useUpdateProjectTemplate,
  useDeleteProjectTemplate,
  useTemplateVersions,
  useRestoreTemplateVersion,
  type ProjectTemplate,
  type TemplateCustomField,
} from '@/hooks/useProjectTemplates';
import { activityTemplateSets } from '@/data/activityTemplates';

interface ActivityItem {
  description: string;
  durationDays: number;
  weight: number;
}

interface FormState {
  name: string;
  description: string;
  is_project_phase: boolean;
  default_contract_value: string;
  selected_activity_template: string;
  custom_activities: ActivityItem[];
  category: string;
  custom_fields: TemplateCustomField[];
}

const CATEGORIES = [
  { value: 'geral', label: 'Geral' },
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'reforma', label: 'Reforma' },
  { value: 'projeto', label: 'Projeto' },
];

const emptyForm: FormState = {
  name: '',
  description: '',
  is_project_phase: false,
  default_contract_value: '',
  selected_activity_template: '',
  custom_activities: [],
  category: 'geral',
  custom_fields: [],
};

type SortField = 'name' | 'created_at' | 'is_project_phase' | 'usage_count';

export function TemplatesTab() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useProjectTemplates();
  const createTemplate = useCreateProjectTemplate();
  const updateTemplate = useUpdateProjectTemplate();
  const deleteTemplate = useDeleteProjectTemplate();
  const restoreVersion = useRestoreTemplateVersion();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Search, sort & filter
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [filterCategory, setFilterCategory] = useState<string>('__all__');

  // Preview sheet
  const [previewTemplate, setPreviewTemplate] = useState<ProjectTemplate | null>(null);
  const { data: versions } = useTemplateVersions(previewTemplate?.id ?? null);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  // Import ref
  const importInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    if (!templates) return [];
    const cats = new Set(templates.map((t) => t.category || 'geral'));
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    if (!templates) return [];
    let list = templates;
    if (filterCategory !== '__all__') {
      list = list.filter((t) => (t.category || 'geral') === filterCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'is_project_phase') return (a.is_project_phase ? 0 : 1) - (b.is_project_phase ? 0 : 1);
      if (sortBy === 'usage_count') return (b.usage_count ?? 0) - (a.usage_count ?? 0);
      return 0;
    });
  }, [templates, search, sortBy, filterCategory]);

  const resolveActivities = (f: FormState): ActivityItem[] => {
    if (f.selected_activity_template === '__none__' || !f.selected_activity_template) return [];
    if (f.selected_activity_template === '__custom__') return f.custom_activities;
    const preset = activityTemplateSets.find((a) => a.id === f.selected_activity_template);
    return preset?.activities ?? f.custom_activities;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: ProjectTemplate) => {
    setEditingId(t.id);
    const activities = (t.default_activities ?? []) as ActivityItem[];
    const actMatch = activityTemplateSets.find(
      (a) => JSON.stringify(a.activities) === JSON.stringify(activities)
    );
    setForm({
      name: t.name,
      description: t.description ?? '',
      is_project_phase: t.is_project_phase,
      default_contract_value: t.default_contract_value?.toString() ?? '',
      selected_activity_template: actMatch?.id ?? (activities.length > 0 ? '__custom__' : '__none__'),
      custom_activities: actMatch ? [] : activities,
      category: t.category || 'geral',
      custom_fields: (t.custom_fields ?? []) as TemplateCustomField[],
    });
    setDialogOpen(true);
  };

  const handlePresetChange = (presetId: string) => {
    if (presetId === '__custom__') {
      const current = resolveActivities(form);
      setForm((p) => ({
        ...p,
        selected_activity_template: '__custom__',
        custom_activities: current.length > 0 ? current : [{ description: '', durationDays: 5, weight: 10 }],
      }));
    } else {
      setForm((p) => ({
        ...p,
        selected_activity_template: presetId,
        custom_activities: [],
      }));
    }
  };

  const updateActivity = (idx: number, field: keyof ActivityItem, value: string | number) => {
    setForm((p) => {
      const acts = [...p.custom_activities];
      acts[idx] = { ...acts[idx], [field]: value };
      return { ...p, custom_activities: acts };
    });
  };

  const addActivity = () => {
    setForm((p) => ({
      ...p,
      custom_activities: [...p.custom_activities, { description: '', durationDays: 5, weight: 5 }],
    }));
  };

  const removeActivity = (idx: number) => {
    setForm((p) => ({
      ...p,
      custom_activities: p.custom_activities.filter((_, i) => i !== idx),
    }));
  };

  // Drag & drop handlers
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === to) return;
    setForm((p) => {
      const acts = [...p.custom_activities];
      const [moved] = acts.splice(from, 1);
      acts.splice(to, 0, moved);
      return { ...p, custom_activities: acts };
    });
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const activities = resolveActivities(form);
    // Filter out activities with empty descriptions
    const validActivities = activities.filter((a) => a.description.trim());
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_project_phase: form.is_project_phase,
      default_activities: validActivities,
      default_contract_value: form.default_contract_value ? parseFloat(form.default_contract_value) : null,
      category: form.category,
      custom_fields: form.custom_fields.filter(f => f.key.trim() && f.label.trim()),
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
    const activities = (t.default_activities ?? []) as ActivityItem[];
    const actMatch = activityTemplateSets.find(
      (a) => JSON.stringify(a.activities) === JSON.stringify(activities)
    );
    setForm({
      name: `${t.name} (cópia)`,
      description: t.description ?? '',
      is_project_phase: t.is_project_phase,
      default_contract_value: t.default_contract_value?.toString() ?? '',
      selected_activity_template: actMatch?.id ?? (activities.length > 0 ? '__custom__' : '__none__'),
      custom_activities: actMatch ? [] : activities,
      category: t.category || 'geral',
      custom_fields: (t.custom_fields ?? []) as TemplateCustomField[],
    });
    setDialogOpen(true);
  };

  // Export template as JSON
  const handleExport = useCallback((t: ProjectTemplate) => {
    const exportData = {
      name: t.name,
      description: t.description,
      is_project_phase: t.is_project_phase,
      default_activities: t.default_activities,
      default_contract_value: t.default_contract_value,
      category: t.category,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${t.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Template exportado' });
  }, [toast]);

  // Export all templates
  const handleExportAll = useCallback(() => {
    if (!templates?.length) return;
    const exportData = templates.map((t) => ({
      name: t.name,
      description: t.description,
      is_project_phase: t.is_project_phase,
      default_activities: t.default_activities,
      default_contract_value: t.default_contract_value,
      category: t.category,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'templates-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${templates.length} templates exportados` });
  }, [templates, toast]);

  // Import templates from JSON
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;
      for (const item of items) {
        if (!item.name || typeof item.name !== 'string') continue;
        // Validate activities structure
        const activities = Array.isArray(item.default_activities)
          ? item.default_activities
              .filter((a: any) => a?.description && typeof a.durationDays === 'number' && typeof a.weight === 'number')
              .map((a: any) => ({
                description: String(a.description).slice(0, 200),
                durationDays: Math.max(1, Math.round(a.durationDays)),
                weight: Math.max(0, Math.min(100, Math.round(a.weight))),
              }))
          : [];
        await createTemplate.mutateAsync({
          name: item.name.slice(0, 200),
          description: item.description ? String(item.description).slice(0, 500) : undefined,
          is_project_phase: !!item.is_project_phase,
          default_activities: activities,
          default_contract_value: typeof item.default_contract_value === 'number' ? item.default_contract_value : null,
          category: typeof item.category === 'string' ? item.category : 'geral',
        });
        count++;
      }
      toast({ title: count > 0 ? `${count} template(s) importado(s)` : 'Nenhum template válido encontrado' });
    } catch {
      toast({ title: 'Erro ao importar JSON', variant: 'destructive' });
    }
    // Reset input
    if (importInputRef.current) importInputRef.current.value = '';
  }, [createTemplate, toast]);

  const totalWeight = (acts: ActivityItem[]) => acts.reduce((s, a) => s + a.weight, 0);
  const totalDays = (acts: ActivityItem[]) => acts.reduce((s, a) => s + a.durationDays, 0);

  const getCategoryLabel = (cat: string) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-h3 font-bold">Templates de Obra</h2>
          <p className="text-sm text-muted-foreground">
            Crie templates reutilizáveis para agilizar o cadastro de novas obras
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          {templates && templates.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportAll} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar todos
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Search, Sort & Category Filter */}
      {templates && templates.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="pl-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch('')}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {categories.length > 1 && (
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px]">
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome (A-Z)</SelectItem>
              <SelectItem value="created_at">Mais recentes</SelectItem>
              <SelectItem value="usage_count">Mais usados</SelectItem>
              <SelectItem value="is_project_phase">Tipo (Fase)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum template encontrado</p>
          <Button variant="link" onClick={() => { setSearch(''); setFilterCategory('__all__'); }}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const acts = (t.default_activities ?? []) as ActivityItem[];
            return (
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
                    <Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(t)} className="h-8 gap-1">
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-8 gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(t)} className="h-8 gap-1">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExport(t)} className="h-8 gap-1">
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
                          <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Sheet */}
      <Sheet open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {previewTemplate && (
            <>
              <SheetHeader>
                <SheetTitle>{previewTemplate.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                {previewTemplate.description && (
                  <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium text-sm">
                      {previewTemplate.is_project_phase ? 'Fase de Projeto' : 'Execução'}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Categoria</p>
                    <p className="font-medium text-sm">{getCategoryLabel(previewTemplate.category || 'geral')}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Valor Padrão</p>
                    <p className="font-medium text-sm">
                      {previewTemplate.default_contract_value
                        ? `R$ ${Number(previewTemplate.default_contract_value).toLocaleString('pt-BR')}`
                        : '—'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">
                    Atividades ({(previewTemplate.default_activities ?? []).length})
                  </h4>
                {(previewTemplate.default_activities ?? []).length > 0 ? (
                    <>
                      {/* Mini-Gantt */}
                      <div className="rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
                        <div className="space-y-1">
                          {(() => {
                            const acts = previewTemplate.default_activities as ActivityItem[];
                            const cumDays: number[] = [];
                            let acc = 0;
                            acts.forEach(a => { cumDays.push(acc); acc += a.durationDays; });
                            const total = acc;
                            return acts.map((act, i) => (
                              <div key={i} className="flex items-center gap-2 group/bar">
                                <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                                <div className="flex-1 h-4 relative rounded-sm overflow-hidden bg-muted">
                                  <div
                                    className="absolute top-0 h-full rounded-sm bg-primary/60 group-hover/bar:bg-primary/80 transition-colors"
                                    style={{
                                      left: `${(cumDays[i] / total) * 100}%`,
                                      width: `${Math.max((act.durationDays / total) * 100, 2)}%`,
                                    }}
                                    title={`${act.description} — ${act.durationDays}d`}
                                  />
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">Dia 1</span>
                          <span className="text-[10px] text-muted-foreground">Dia {totalDays(previewTemplate.default_activities as ActivityItem[])}</span>
                        </div>
                      </div>
                      {/* Table */}
                      <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Atividade</TableHead>
                            <TableHead className="text-xs w-20 text-right">Dias</TableHead>
                            <TableHead className="text-xs w-20 text-right">Peso %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(previewTemplate.default_activities as ActivityItem[]).map((act, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm">{act.description}</TableCell>
                              <TableCell className="text-sm text-right">{act.durationDays}</TableCell>
                              <TableCell className="text-sm text-right">{act.weight}%</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-medium">
                            <TableCell className="text-sm">Total</TableCell>
                            <TableCell className="text-sm text-right">
                              {totalDays(previewTemplate.default_activities as ActivityItem[])}d
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {totalWeight(previewTemplate.default_activities as ActivityItem[])}%
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma atividade pré-definida</p>
                  )}
                </div>

                {/* Version History */}
                {versions && versions.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">Histórico de versões ({versions.length})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {versions.map((v) => (
                          <div key={v.id} className="flex items-center justify-between rounded-lg border p-2.5">
                            <div>
                              <p className="text-sm font-medium">v{v.version_number} — {v.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(v.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={restoreVersion.isPending}
                              onClick={async () => {
                                try {
                                  await restoreVersion.mutateAsync({ templateId: previewTemplate.id, version: v });
                                  toast({ title: `Restaurado para v${v.version_number}` });
                                  setPreviewTemplate(null);
                                } catch {
                                  toast({ title: 'Erro ao restaurar', variant: 'destructive' });
                                }
                              }}
                            >
                              Restaurar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => { setPreviewTemplate(null); openEdit(previewTemplate); }} className="flex-1 gap-2">
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="outline" onClick={() => handleExport(previewTemplate)} className="gap-2">
                    <Download className="h-4 w-4" /> Exportar
                  </Button>
                  <Button variant="outline" onClick={() => { setPreviewTemplate(null); handleDuplicate(previewTemplate); }} className="gap-2">
                    <Copy className="h-4 w-4" /> Duplicar
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-4">
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
                <Label htmlFor="tpl-value">Valor padrão (R$)</Label>
                <Input
                  id="tpl-value"
                  type="number"
                  step="0.01"
                  value={form.default_contract_value}
                  onChange={(e) => setForm((p) => ({ ...p, default_contract_value: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Descrição</Label>
              <Textarea
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva quando usar este template..."
                rows={2}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
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
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Cronograma padrão</Label>
                <Select
                  value={form.selected_activity_template}
                  onValueChange={handlePresetChange}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecionar base" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {activityTemplateSets.map((at) => (
                      <SelectItem key={at.id} value={at.id}>
                        {at.emoji} {at.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">✏️ Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom activities with drag & drop */}
              {form.selected_activity_template === '__custom__' ? (
                <div className="space-y-2">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8" />
                          <TableHead className="text-xs">Atividade</TableHead>
                          <TableHead className="text-xs w-20">Dias</TableHead>
                          <TableHead className="text-xs w-20">Peso %</TableHead>
                          <TableHead className="text-xs w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.custom_activities.map((act, i) => (
                          <TableRow
                            key={i}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={(e) => handleDragOver(e, i)}
                            onDrop={handleDrop}
                            className="cursor-move"
                          >
                            <TableCell className="p-1 w-8">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                value={act.description}
                                onChange={(e) => updateActivity(i, 'description', e.target.value)}
                                placeholder="Descrição..."
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                value={act.durationDays}
                                onChange={(e) => updateActivity(i, 'durationDays', parseInt(e.target.value) || 1)}
                                className="h-8 text-sm w-16"
                                min={1}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                value={act.weight}
                                onChange={(e) => updateActivity(i, 'weight', parseInt(e.target.value) || 0)}
                                className="h-8 text-sm w-16"
                                min={0}
                                max={100}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeActivity(i)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={addActivity} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> Atividade
                    </Button>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        Total: {totalDays(form.custom_activities)}d · {totalWeight(form.custom_activities)}%
                      </span>
                      {form.custom_activities.length > 0 && totalWeight(form.custom_activities) !== 100 && (
                        <span className="text-xs text-amber-600">
                          ⚠ Peso total ≠ 100%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : form.selected_activity_template && form.selected_activity_template !== '__none__' ? (
                <div className="rounded-lg border p-3 bg-muted/30">
                  {(() => {
                    const preset = activityTemplateSets.find((a) => a.id === form.selected_activity_template);
                    if (!preset) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{preset.emoji} {preset.name}</p>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.activities.length} atividades · {totalDays(preset.activities)}d · {totalWeight(preset.activities)}% peso total
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>

          {/* Custom Fields Editor */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campos customizados</Label>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setForm(p => ({
                  ...p,
                  custom_fields: [...p.custom_fields, { key: '', label: '', type: 'text' as const }],
                }))}
              >
                <Plus className="h-3.5 w-3.5" /> Campo
              </Button>
            </div>
            {form.custom_fields.length > 0 && (
              <div className="space-y-2">
                {form.custom_fields.map((field, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input
                      value={field.key}
                      onChange={(e) => {
                        const updated = [...form.custom_fields];
                        updated[i] = { ...updated[i], key: e.target.value.replace(/\s+/g, '_').toLowerCase() };
                        setForm(p => ({ ...p, custom_fields: updated }));
                      }}
                      placeholder="chave"
                      className="h-8 text-sm w-24"
                    />
                    <Input
                      value={field.label}
                      onChange={(e) => {
                        const updated = [...form.custom_fields];
                        updated[i] = { ...updated[i], label: e.target.value };
                        setForm(p => ({ ...p, custom_fields: updated }));
                      }}
                      placeholder="Rótulo"
                      className="h-8 text-sm flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(v) => {
                        const updated = [...form.custom_fields];
                        updated[i] = { ...updated[i], type: v as 'text' | 'number' | 'select' };
                        setForm(p => ({ ...p, custom_fields: updated }));
                      }}
                    >
                      <SelectTrigger className="h-8 w-24 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="select">Seleção</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => setForm(p => ({ ...p, custom_fields: p.custom_fields.filter((_, j) => j !== i) }))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
