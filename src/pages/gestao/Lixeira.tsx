import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpDown, RotateCcw, Search, Trash2, Trash } from 'lucide-react';
import {
  getDeletedProjects,
  restoreProject,
  hardDeleteProject,
  type ProjectWithCustomer,
} from '@/infra/repositories/projects.repository';
import { projectKeys } from '@/hooks/useProjectsQuery';
import { useUserRole } from '@/hooks/useUserRole';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ContentSkeleton } from '@/components/ContentSkeleton';
import { EmptyState } from '@/components/states';
import { statusColors, statusLabels } from '@/components/admin/obras/obraCardUtils';

type SortKey = 'deleted_at' | 'name' | 'customer_name';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'draft' | 'active' | 'completed' | 'paused' | 'cancelled';
type RangeFilter = 'all' | '7d' | '30d' | '90d';

const trashKey = ['projects', 'trash'] as const;

export default function Lixeira() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('deleted_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery({
    queryKey: trashKey,
    queryFn: async () => {
      const res = await getDeletedProjects();
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const restoreMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await restoreProject(id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Obra restaurada');
      queryClient.invalidateQueries({ queryKey: trashKey });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (e: Error) => toast.error('Erro ao restaurar: ' + e.message),
  });

  const hardDeleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await hardDeleteProject(id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Obra excluída definitivamente');
      queryClient.invalidateQueries({ queryKey: trashKey });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (e: Error) => toast.error('Erro ao excluir: ' + e.message),
  });

  const filtered = useMemo(() => {
    let rows: (ProjectWithCustomer & { deleted_at?: string | null })[] = (data ?? []) as any;
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.customer_name?.toLowerCase().includes(term) ||
        p.unit_name?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(p => p.status === statusFilter);
    }
    if (rangeFilter !== 'all') {
      const days = rangeFilter === '7d' ? 7 : rangeFilter === '30d' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rows = rows.filter(p => p.deleted_at && new Date(p.deleted_at).getTime() >= cutoff);
    }
    rows = [...rows].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'deleted_at') {
        av = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
        bv = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
      } else if (sortKey === 'name') {
        av = a.name?.toLowerCase() ?? '';
        bv = b.name?.toLowerCase() ?? '';
      } else {
        av = a.customer_name?.toLowerCase() ?? '';
        bv = b.customer_name?.toLowerCase() ?? '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data, search, statusFilter, rangeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'deleted_at' ? 'desc' : 'asc'); }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Obras movidas para a lixeira. Restaure para reativar ou exclua definitivamente.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cliente ou unidade"
            className="pl-8"
            aria-label="Buscar obras na lixeira"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={rangeFilter} onValueChange={(v) => setRangeFilter(v as RangeFilter)}>
          <SelectTrigger className="w-[180px]" aria-label="Filtrar por período de exclusão">
            <SelectValue placeholder="Excluída em" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer período</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'obra' : 'obras'}
        </span>
      </div>

      {isLoading ? (
        <ContentSkeleton variant="table" rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Nenhuma obra na lixeira"
          description="Quando você mover uma obra para a lixeira, ela aparecerá aqui e poderá ser restaurada."
        />
      ) : (
        <div className="rounded-md border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Obra <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead className="text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSort('customer_name')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Cliente <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSort('deleted_at')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    aria-label={`Ordenar por data de exclusão (${sortDir === 'asc' ? 'crescente' : 'decrescente'})`}
                  >
                    Excluída em <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead className="w-[200px] text-right text-xs">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const deletedAt = p.deleted_at ? new Date(p.deleted_at) : null;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        {p.unit_name && (
                          <p className="text-xs text-muted-foreground truncate">{p.unit_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.customer_name ?? <span className="text-muted-foreground italic text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[p.status]}>
                        {statusLabels[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deletedAt ? (
                        <div className="flex flex-col">
                          <span className="text-sm tabular-nums">
                            {format(deletedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(deletedAt, { locale: ptBR, addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreMut.mutate(p.id)}
                          disabled={restoreMut.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                          Restaurar
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir obra definitivamente?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Todos os dados associados a{' '}
                                  <strong>{p.name}</strong> serão removidos permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => hardDeleteMut.mutate(p.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir definitivamente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
