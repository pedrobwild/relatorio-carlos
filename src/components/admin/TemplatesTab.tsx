import { Plus, Search, X, Upload, Download, FileText, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplatesTabState } from "./templates/useTemplatesTabState";
import { TemplateCard } from "./templates/TemplateCard";
import { TemplatePreviewSheet } from "./templates/TemplatePreviewSheet";
import { TemplateFormDialog } from "./templates/TemplateFormDialog";
import { getCategoryLabel, type SortField } from "./templates/types";

export function TemplatesTab() {
  const state = useTemplatesTabState();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-h3 font-bold">Templates de Obra</h2>
          <p className="text-sm text-muted-foreground">
            Crie templates reutilizáveis para agilizar o cadastro de novas obras
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={state.importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={state.handleImport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => state.importInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          {state.templates && state.templates.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={state.handleExportAll}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Exportar todos
            </Button>
          )}
          <Button onClick={state.openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Search, Sort & Filter */}
      {state.templates && state.templates.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={state.search}
              onChange={(e) => state.setSearch(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="pl-9"
            />
            {state.search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => state.setSearch("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {state.categories.length > 1 && (
            <Select
              value={state.filterCategory}
              onValueChange={state.setFilterCategory}
            >
              <SelectTrigger className="w-[160px]">
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {state.categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {getCategoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={state.sortBy}
            onValueChange={(v) => state.setSortBy(v as SortField)}
          >
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

      {/* Content */}
      {state.isLoading ? (
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
      ) : !state.templates?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Nenhum template criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Templates ajudam a padronizar o cadastro de obras
            </p>
            <Button
              onClick={state.openCreate}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : state.filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Nenhum template encontrado</p>
          <Button
            variant="link"
            onClick={() => {
              state.setSearch("");
              state.setFilterCategory("__all__");
            }}
          >
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPreview={state.setPreviewTemplate}
              onEdit={state.openEdit}
              onDuplicate={state.handleDuplicate}
              onExport={state.handleExport}
              onDelete={state.handleDelete}
            />
          ))}
        </div>
      )}

      {/* Preview Sheet */}
      <TemplatePreviewSheet
        template={state.previewTemplate}
        onClose={() => state.setPreviewTemplate(null)}
        versions={state.versions}
        restoreVersion={state.restoreVersion}
        onEdit={state.openEdit}
        onExport={state.handleExport}
        onDuplicate={state.handleDuplicate}
        toast={state.toast}
      />

      {/* Form Dialog */}
      <TemplateFormDialog
        open={state.dialogOpen}
        onOpenChange={state.setDialogOpen}
        editingId={state.editingId}
        form={state.form}
        setForm={state.setForm}
        onSave={state.handleSave}
        isSaving={
          state.createTemplate.isPending || state.updateTemplate.isPending
        }
        onPresetChange={state.handlePresetChange}
        onUpdateActivity={state.updateActivity}
        onAddActivity={state.addActivity}
        onRemoveActivity={state.removeActivity}
        onDragStart={state.handleDragStart}
        onDragOver={state.handleDragOver}
        onDrop={state.handleDrop}
      />
    </div>
  );
}
