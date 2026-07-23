/**
 * Suprimentos — Onda E1
 * Lista cross-obra de requisições de material com filtros e criação rápida.
 * Staff-only (rota StaffRoute + RLS is_staff()).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, ExternalLink, Search, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import {
  useCreateRequisition,
  useRequisitions,
  type RequisitionStatus,
} from "@/hooks/useSuprimentos";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { parseLocalDate } from "@/lib/dates";

const STATUS_META: Record<
  RequisitionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  aberta: { label: "Aberta", variant: "secondary" },
  em_cotacao: { label: "Em cotação", variant: "secondary" },
  pedido_emitido: { label: "Pedido emitido", variant: "default" },
  atendida: { label: "Atendida", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function Suprimentos() {
  const [projectId, setProjectId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const projectsQ = useProjectsQuery();
  const projects = projectsQ.data ?? [];

  const listQ = useRequisitions({
    projectId: projectId === "all" ? undefined : projectId,
    status:
      status === "all" ? undefined : (status as RequisitionStatus),
  });

  const filtered = useMemo(() => {
    const rows = listQ.data ?? [];
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.notes ?? "").toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle),
    );
  }, [listQ.data, q]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-safe-4 py-6 sm:px-safe-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suprimentos</h1>
          <p className="text-sm text-muted-foreground">
            Requisições de material, cotações e conversão em pedido.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]">
              <Plus className="mr-2 h-4 w-4" />
              Nova requisição
            </Button>
          </DialogTrigger>
          <CreateRequisitionDialog
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Notas ou ID"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Obra</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
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
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.keys(STATUS_META) as RequisitionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {listQ.isLoading ? (
        <PageSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma requisição"
          description="Crie a primeira requisição para começar a rastrear pedidos de material."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status as RequisitionStatus];
            const project = projects.find((p) => p.id === r.project_id);
            return (
              <Card key={r.id} className="transition hover:border-primary/40">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <span className="text-sm font-medium">
                        {project?.name ?? "Obra desconhecida"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Criada em{" "}
                      {format(parseISO(r.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                      {r.needed_by && (
                        <>
                          {" · Necessária em "}
                          {format(parseLocal(r.needed_by), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1 line-clamp-2 text-sm text-foreground/80">
                        {r.notes}
                      </p>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm" className="min-h-[40px]">
                    <Link to={`/gestao/suprimentos/${r.id}`}>
                      Abrir
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateRequisitionDialog({
  projects,
  onClose,
}: {
  projects: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState<string>("");
  const [neededBy, setNeededBy] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const createM = useCreateRequisition();

  const canSubmit = !!projectId && !createM.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createM.mutateAsync({
      project_id: projectId,
      needed_by: neededBy || null,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Nova requisição</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Obra *</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="mt-1">
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
          <Label>Necessária em</Label>
          <Input
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contexto, prioridade, referência de projeto…"
            className="mt-1"
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {createM.isPending ? "Criando…" : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
