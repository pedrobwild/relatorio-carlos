import { useState, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectTemplates,
  useCreateProjectTemplate,
  useUpdateProjectTemplate,
  useDeleteProjectTemplate,
  useTemplateVersions,
  useRestoreTemplateVersion,
  type ProjectTemplate,
} from '@/hooks/useProjectTemplates';
import { activityTemplateSets } from '@/data/activityTemplates';
import { matchesSearch } from '@/lib/searchNormalize';
import { emptyForm, type FormState, type ActivityItem, type SortField } from './types';

export function useTemplatesTabState() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useProjectTemplates();
  const createTemplate = useCreateProjectTemplate();
  const updateTemplate = useUpdateProjectTemplate();
  const deleteTemplate = useDeleteProjectTemplate();
  const restoreVersion = useRestoreTemplateVersion();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [filterCategory, setFilterCategory] = useState<string>('__all__');

  const [previewTemplate, setPreviewTemplate] = useState<ProjectTemplate | null>(null);
  const { data: versions } = useTemplateVersions(previewTemplate?.id ?? null);

  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
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
      custom_fields: (t.custom_fields ?? []) as FormState['custom_fields'],
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
      setForm((p) => ({ ...p, selected_activity_template: presetId, custom_activities: [] }));
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

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); dragOverIdx.current = idx; };
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
    const validActivities = activities.filter((a) => a.description.trim());
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
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
      custom_fields: (t.custom_fields ?? []) as FormState['custom_fields'],
    });
    setDialogOpen(true);
  };

  const handleExport = useCallback((t: ProjectTemplate) => {
    const exportData = {
      name: t.name, description: t.description, is_project_phase: t.is_project_phase,
      default_activities: t.default_activities, default_contract_value: t.default_contract_value, category: t.category,
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

  const handleExportAll = useCallback(() => {
    if (!templates?.length) return;
    const exportData = templates.map((t) => ({
      name: t.name, description: t.description, is_project_phase: t.is_project_phase,
      default_activities: t.default_activities, default_contract_value: t.default_contract_value, category: t.category,
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
    if (importInputRef.current) importInputRef.current.value = '';
  }, [createTemplate, toast]);

  return {
    templates, isLoading, filtered, categories,
    dialogOpen, setDialogOpen, editingId, form, setForm,
    search, setSearch, sortBy, setSortBy, filterCategory, setFilterCategory,
    previewTemplate, setPreviewTemplate, versions, restoreVersion,
    importInputRef,
    openCreate, openEdit, handlePresetChange,
    updateActivity, addActivity, removeActivity,
    handleDragStart, handleDragOver, handleDrop,
    handleSave, handleDelete, handleDuplicate,
    handleExport, handleExportAll, handleImport,
    createTemplate, updateTemplate,
    toast,
  };
}
