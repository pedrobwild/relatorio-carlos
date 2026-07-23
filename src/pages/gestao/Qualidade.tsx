import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  ListChecks,
  ExternalLink,
  KeySquare,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";


import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageSkeleton } from "@/components/ui/states";

import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import {
  inspectionChecklistTemplatesRepo,
  type ChecklistTemplate,
} from "@/infra/repositories/inspectionChecklistTemplates.repository";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import {
  usePunchItems,
  useCreatePunchItem,
  useUpdatePunchItem,
  useResolvePunchItem,
  useVerifyPunchItem,
  useReopenPunchItem,
  useDeletePunchItem,
  type PunchItem,
} from "@/hooks/usePunchItems";
import { CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


/* ============================================================================
 * Página /gestao/qualidade  (StaffRoute)
 * Aba Templates: CRUD de checklists reutilizáveis.
 * Aba Inspeções: lista cross-project das últimas vistorias.
 * ==========================================================================*/

export default function Qualidade() {
  return (
    <div className="mx-auto max-w-6xl px-safe-4 sm:px-safe-6 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Qualidade</h1>
        <p className="text-sm text-muted-foreground">
          Templates de checklist de vistoria e acompanhamento das inspeções.
        </p>
      </header>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="inspecoes" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Inspeções
          </TabsTrigger>
          <TabsTrigger value="entrega" className="gap-2">
            <KeySquare className="h-4 w-4" />
            Entrega
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="inspecoes" className="space-y-4">
          <InspecoesTab />
        </TabsContent>

        <TabsContent value="entrega" className="space-y-4">
          <PunchListTab />
        </TabsContent>
      </Tabs>

    </div>
  );
}

/* --------------------------------------------------------------------------
 * Templates Tab
 * ------------------------------------------------------------------------*/

function TemplatesTab() {
  const qc = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: [...queryKeys.qualidade.templates(), { includeArchived }],
    queryFn: async () => {
      const res =
        await inspectionChecklistTemplatesRepo.list(includeArchived);
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    staleTime: 60_000,
  });

  const toggleActive = useMutation({
    mutationFn: async (t: ChecklistTemplate) => {
      const res = await inspectionChecklistTemplatesRepo.update(t.id, {
        is_active: !t.is_active,
      });
      if (res.error) throw new Error(res.error.userError.userMessage);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.qualidade.all });
      toast.success("Template atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateM = useMutation({
    mutationFn: async (id: string) => {
      const res = await inspectionChecklistTemplatesRepo.duplicate(id);
      if (res.error) throw new Error("Não foi possível duplicar o template");
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.qualidade.all });
      toast.success("Template duplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const res = await inspectionChecklistTemplatesRepo.remove(id);
      if (res.error) throw new Error(res.error.userError.userMessage);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.qualidade.all });
      toast.success("Template excluído");
      setConfirmDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = templatesQuery.data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, ChecklistTemplate[]>();
    for (const t of templates) {
      const key = t.category?.trim() || "Sem categoria";
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Switch
            id="show-archived"
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
          />
          <Label htmlFor="show-archived" className="text-sm">
            Mostrar arquivados
          </Label>
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingId(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Novo template
        </Button>
      </div>

      {templatesQuery.isLoading ? (
        <PageSkeleton />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhum template ainda"
          description="Crie um template de checklist reutilizável para agilizar novas vistorias."
          action={{
            label: "Criar primeiro template",
            onClick: () => {
              setEditingId(null);
              setEditorOpen(true);
            },
            icon: Plus,
          }}
        />
      ) : (
        grouped.map(([category, list]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {category}
                <Badge variant="secondary" className="text-[10px]">
                  {list.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {list.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium truncate ${
                          !t.is_active ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {t.name}
                      </span>
                      {!t.is_active && (
                        <Badge variant="outline" className="text-[10px]">
                          Arquivado
                        </Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      title="Editar"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      title="Duplicar"
                      disabled={duplicateM.isPending}
                      onClick={() => duplicateM.mutate(t.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      title={t.is_active ? "Arquivar" : "Reativar"}
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(t)}
                    >
                      {t.is_active ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      title="Excluir"
                      onClick={() => setConfirmDeleteId(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={editingId}
      />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Vistorias já criadas a partir
              deste template não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmDeleteId && deleteM.mutate(confirmDeleteId)
              }
              disabled={deleteM.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Template Editor
 * ------------------------------------------------------------------------*/

interface EditorItem {
  description: string;
  category: string;
}

function TemplateEditorDialog({
  open,
  onOpenChange,
  templateId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateId: string | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!templateId;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<EditorItem[]>([]);
  const [newItemText, setNewItemText] = useState("");

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: queryKeys.qualidade.template(templateId ?? undefined),
    queryFn: async () => {
      const res = await inspectionChecklistTemplatesRepo.getWithItems(
        templateId!,
      );
      if (res.error) throw new Error(res.error.userError.userMessage);
      return res.data;
    },
    enabled: open && !!templateId,
  });

  // hydrate on open
  useMemo(() => {
    if (!open) return;
    if (isEdit && existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setCategory(existing.category ?? "");
      setItems(
        existing.items.map((it) => ({
          description: it.description,
          category: it.category ?? "",
        })),
      );
    } else if (!isEdit) {
      setName("");
      setDescription("");
      setCategory("");
      setItems([]);
      setNewItemText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const saveM = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Informe o nome do template");

      let id = templateId;
      if (isEdit && id) {
        const res = await inspectionChecklistTemplatesRepo.update(id, {
          name: trimmedName,
          description,
          category,
        });
        if (res.error) throw new Error(res.error.userError.userMessage);
      } else {
        const res = await inspectionChecklistTemplatesRepo.create({
          name: trimmedName,
          description,
          category,
        });
        if (res.error || !res.data)
          throw new Error(
            res.error?.userError.userMessage ?? "Falha ao criar template",
          );
        id = res.data.id;
      }
      const itemsRes = await inspectionChecklistTemplatesRepo.replaceItems(
        id!,
        items,
      );
      if (itemsRes.error) throw new Error("Falha ao salvar itens");
      return id!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.qualidade.all });
      toast.success(isEdit ? "Template atualizado" : "Template criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => {
    const t = newItemText.trim();
    if (!t) return;
    setItems((prev) => [...prev, { description: t, category }]);
    setNewItemText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar template" : "Novo template de checklist"}
          </DialogTitle>
        </DialogHeader>

        {isEdit && loadingExisting ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome do template *</Label>
                <Input
                  placeholder="Ex: Vistoria pré-entrega de apartamento"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  placeholder="Ex: Entrega, Rotina, Elétrica..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  placeholder="Contexto de uso do template"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Itens do checklist</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Novo item... (Enter para adicionar)"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addItem}
                  disabled={!newItemText.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum item adicionado.
                </p>
              ) : (
                <ol className="border rounded-md divide-y max-h-72 overflow-y-auto">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2 gap-2"
                    >
                      <span className="text-sm truncate flex-1">
                        <span className="text-muted-foreground mr-2">
                          {i + 1}.
                        </span>
                        {it.description}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === 0}
                          onClick={() =>
                            setItems((prev) => {
                              const next = prev.slice();
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              return next;
                            })
                          }
                          title="Mover para cima"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={i === items.length - 1}
                          onClick={() =>
                            setItems((prev) => {
                              const next = prev.slice();
                              [next[i], next[i + 1]] = [next[i + 1], next[i]];
                              return next;
                            })
                          }
                          title="Mover para baixo"
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, j) => j !== i))
                          }
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveM.mutate()}
            disabled={!name.trim() || saveM.isPending}
          >
            {saveM.isPending ? "Salvando..." : "Salvar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
 * Inspeções Tab — cross-project view (read only, links to project pages)
 * ------------------------------------------------------------------------*/

interface InspecaoRow {
  id: string;
  project_id: string;
  project_name: string | null;
  inspection_date: string | null;
  inspection_type: string | null;
  status: string | null;
  created_at: string;
}

function InspecoesTab() {
  const query = useQuery({
    queryKey: queryKeys.qualidade.inspecoes(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, project_id, inspection_date, inspection_type, status, created_at, projects:project_id(name)",
        )
        .order("inspection_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        project_id: r.project_id,
        project_name:
          (r as unknown as { projects?: { name?: string | null } }).projects
            ?.name ?? null,
        inspection_date: r.inspection_date,
        inspection_type: r.inspection_type,
        status: r.status,
        created_at: r.created_at,
      })) as InspecaoRow[];
    },
    staleTime: 30_000,
  });

  if (query.isLoading) return <PageSkeleton />;
  const rows = query.data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Nenhuma vistoria registrada"
        description="Crie uma vistoria a partir da obra correspondente."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {r.project_name ?? "Obra sem nome"}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {r.inspection_type && (
                    <Badge variant="outline" className="text-[10px]">
                      {r.inspection_type}
                    </Badge>
                  )}
                  {r.inspection_date && (
                    <span>
                      {new Date(r.inspection_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {r.status && <span>· {r.status}</span>}
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link to={`/obra/${r.project_id}/vistorias`}>
                  Abrir
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------------------
 * Punch List Tab (Onda D2) — pendências de entrega por ambiente
 * ------------------------------------------------------------------------*/

type PunchStatusFilter = "abertas" | "resolvido" | "verificado" | "todas";

function PunchListTab() {
  const initialParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const [projectId, setProjectId] = useState<string>(
    initialParams.get("projectId") ?? "all",
  );
  const [responsibleUserId, setResponsibleUserId] = useState<string>("all");
  const [statusFilter, setStatusFilter] =
    useState<PunchStatusFilter>("abertas");

  const projectsQuery = useProjectsQuery();
  const staffQuery = useStaffUsers();

  const projects = projectsQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const staffMap = useMemo(
    () => new Map(staff.map((u) => [u.id, u.nome])),
    [staff],
  );

  const punchQuery = usePunchItems({
    projectId: projectId === "all" ? undefined : projectId,
    responsibleUserId:
      responsibleUserId === "all" ? undefined : responsibleUserId,
    status:
      statusFilter === "abertas"
        ? "aberto"
        : statusFilter === "resolvido"
          ? "resolvido"
          : statusFilter === "verificado"
            ? "verificado"
            : undefined,
  });

  const items = punchQuery.data ?? [];

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? "Sem obra";

  const grouped = useMemo(() => {
    const map = new Map<string, PunchItem[]>();
    for (const it of items) {
      const key = `${it.project_id}::${it.ambiente}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).map(([key, list]) => {
      const [pId, ambiente] = key.split("::");
      const total = list.length;
      const done = list.filter((l) => l.status === "verificado").length;
      const resolved = list.filter((l) => l.status !== "aberto").length;
      return {
        key,
        projectId: pId,
        projectName: projectName(pId),
        ambiente,
        items: list,
        total,
        done,
        resolved,
        pct: total === 0 ? 0 : Math.round((done / total) * 100),
        resolvedPct: total === 0 ? 0 : Math.round((resolved / total) * 100),
      };
    });
  }, [items, projects]);

  const [createOpen, setCreateOpen] = useState(false);

  const isLoading = punchQuery.isLoading || projectsQuery.isLoading;

  return (
    <div className="space-y-4">
      {/* Filtros + criação */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Obra</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Responsável</Label>
          <Select
            value={responsibleUserId}
            onValueChange={setResponsibleUserId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {staff.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PunchStatusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertas">Abertas</SelectItem>
              <SelectItem value="resolvido">Aguardando verificação</SelectItem>
              <SelectItem value="verificado">Verificadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="min-h-[44px]"
          disabled={projects.length === 0}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nova pendência
        </Button>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Sem pendências de entrega"
          description="Nenhuma pendência registrada com os filtros atuais."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <Card key={g.key}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{g.ambiente}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {g.projectName} · {g.done}/{g.total} verificadas ·{" "}
                      {g.resolved}/{g.total} resolvidas
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.pct}%
                  </span>
                </div>
                <Progress value={g.pct} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                {g.items.map((it) => (
                  <PunchItemRow
                    key={it.id}
                    item={it}
                    staffMap={staffMap}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePunchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId !== "all" ? projectId : undefined}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        staff={staff}
      />
    </div>
  );
}

function PunchItemRow({
  item,
  staffMap,
}: {
  item: PunchItem;
  staffMap: Map<string, string>;
}) {
  const resolve = useResolvePunchItem();
  const verify = useVerifyPunchItem();
  const reopen = useReopenPunchItem();
  const del = useDeletePunchItem();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const overdue =
    item.status === "aberto" &&
    item.due_date &&
    item.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border border-border/60 bg-card p-3">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-medium">{item.descricao}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {item.responsible_user_id && (
            <span>
              Resp.: {staffMap.get(item.responsible_user_id) ?? "—"}
            </span>
          )}
          {item.due_date && (
            <span className={overdue ? "text-destructive font-medium" : ""}>
              Prazo:{" "}
              {format(new Date(`${item.due_date}T00:00:00`), "dd/MM/yyyy", {
                locale: ptBR,
              })}
            </span>
          )}
          <Badge
            variant={
              item.status === "verificado"
                ? "default"
                : item.status === "resolvido"
                  ? "secondary"
                  : "outline"
            }
            className="text-[10px]"
          >
            {item.status === "aberto"
              ? "Aberta"
              : item.status === "resolvido"
                ? "Aguardando verificação"
                : "Verificada"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.status === "aberto" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve.mutate(item.id)}
            disabled={resolve.isPending}
            className="min-h-[36px]"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Resolver
          </Button>
        )}
        {item.status === "resolvido" && (
          <>
            <Button
              size="sm"
              variant="default"
              onClick={() => verify.mutate(item.id)}
              disabled={verify.isPending}
              className="min-h-[36px]"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Verificar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => reopen.mutate(item.id)}
              disabled={reopen.isPending}
              className="min-h-[36px]"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reabrir
            </Button>
          </>
        )}
        {item.status === "verificado" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reopen.mutate(item.id)}
            disabled={reopen.isPending}
            className="min-h-[36px]"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reabrir
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          className="min-h-[36px] text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pendência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá arquivar a pendência. Você pode restaurá-la
              diretamente no banco caso necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                del.mutate(item.id);
                setConfirmDelete(false);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreatePunchDialog({
  open,
  onOpenChange,
  defaultProjectId,
  projects,
  staff,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
  projects: { id: string; name: string }[];
  staff: { id: string; nome: string }[];
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [ambiente, setAmbiente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState<string>("none");
  const [dueDate, setDueDate] = useState<string>("");

  const create = useCreatePunchItem();

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? "");
      setAmbiente("");
      setDescricao("");
      setResponsibleUserId("none");
      setDueDate("");
    }
  }, [open, defaultProjectId]);

  const submit = async () => {
    if (!projectId || !ambiente.trim() || !descricao.trim()) {
      toast.error("Obra, ambiente e descrição são obrigatórios");
      return;
    }
    await create.mutateAsync({
      project_id: projectId,
      ambiente,
      descricao,
      responsible_user_id:
        responsibleUserId === "none" ? null : responsibleUserId,
      due_date: dueDate || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova pendência de entrega</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Obra *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a obra" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ambiente *</Label>
            <Input
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value)}
              placeholder="Sala, Cozinha, Suíte 1…"
              className="min-h-[44px]"
            />
          </div>
          <div>
            <Label>Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Retocar pintura no rodapé"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Responsável</Label>
              <Select
                value={responsibleUserId}
                onValueChange={setResponsibleUserId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {staff.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Criar pendência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
