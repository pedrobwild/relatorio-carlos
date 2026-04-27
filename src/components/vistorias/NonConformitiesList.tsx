import { useState, useMemo } from 'react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ChevronRight, Clock, RotateCcw, Filter, X, User, ArrowUpDown, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NonConformity, NcSeverity, NcStatus } from '@/hooks/useNonConformities';
import type { NcFilter } from './NcSummaryCards';
import { NC_CATEGORIES } from './ncConstants';
import { matchesSearch } from '@/lib/searchNormalize';

const severityConfig: Record<NcSeverity, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const statusConfig: Record<NcStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberta', variant: 'destructive' },
  in_treatment: { label: 'Em tratamento', variant: 'default' },
  pending_verification: { label: 'Verificação', variant: 'outline' },
  pending_approval: { label: 'Aprovação', variant: 'outline' },
  closed: { label: 'Encerrada', variant: 'secondary' },
  reopened: { label: 'Reaberta', variant: 'destructive' },
};

const allStatuses: NcStatus[] = ['open', 'in_treatment', 'pending_verification', 'pending_approval', 'reopened', 'closed'];
const allSeverities: NcSeverity[] = ['critical', 'high', 'medium', 'low'];

interface Props {
  nonConformities: NonConformity[];
  searchQuery: string;
  onSelect: (nc: NonConformity) => void;
  summaryFilter?: NcFilter;
}

type SortOption = 'created_at' | 'severity' | 'deadline';

const severityOrder: Record<NcSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function NonConformitiesList({ nonConformities, searchQuery, onSelect, summaryFilter }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<NcStatus | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<NcSeverity | null>(null);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterReincident, setFilterReincident] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('created_at');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const hasLocalFilters = !!filterStatus || !!filterSeverity || filterOverdue || filterReincident || filterCategories.length > 0;

  const clearLocalFilters = () => {
    setFilterStatus(null);
    setFilterSeverity(null);
    setFilterCategories([]);
    setFilterOverdue(false);
    setFilterReincident(false);
  };

  const toggleCategory = (cat: string) => {
    setFilterCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filtered = useMemo(() => {
    let result = nonConformities;

    // Apply summary card filter
    if (summaryFilter) {
      switch (summaryFilter.type) {
        case 'overdue':
          result = result.filter(nc => nc.deadline && nc.deadline < today && nc.status !== 'closed');
          break;
        case 'severity':
          result = result.filter(nc => summaryFilter.value.includes(nc.severity) && nc.status !== 'closed');
          break;
        case 'status':
          result = result.filter(nc => nc.status === summaryFilter.value);
          break;
        case 'open':
          result = result.filter(nc => nc.status !== 'closed');
          break;
        case 'category':
          result = result.filter(nc => nc.category === summaryFilter.value && nc.status !== 'closed');
          break;
      }
    }

    // Apply local advanced filters
    if (filterStatus) result = result.filter(nc => nc.status === filterStatus);
    if (filterSeverity) result = result.filter(nc => nc.severity === filterSeverity);
    if (filterCategories.length > 0) result = result.filter(nc => filterCategories.includes(nc.category || ''));
    if (filterOverdue) result = result.filter(nc => nc.deadline && nc.deadline < today && nc.status !== 'closed');
    if (filterReincident) result = result.filter(nc => nc.reopen_count > 0);

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(nc =>
        nc.title.toLowerCase().includes(q) ||
        nc.description?.toLowerCase().includes(q) ||
        ((nc.category || '').toLowerCase().includes(q))
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      if (sortBy === 'severity') return severityOrder[a.severity] - severityOrder[b.severity];
      if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [nonConformities, searchQuery, summaryFilter, filterStatus, filterSeverity, filterCategories, filterOverdue, filterReincident, today, sortBy]);

  if (nonConformities.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nenhuma não conformidade"
        description="NCs serão criadas automaticamente a partir de itens reprovados nas vistorias."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 min-w-[44px]">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {hasLocalFilters && <Badge variant="secondary" className="ml-1 text-[10px]">Ativo</Badge>}
            </Button>
          </CollapsibleTrigger>
          {hasLocalFilters && (
            <Button variant="ghost" size="sm" className="gap-1 h-9 text-xs" onClick={clearLocalFilters}>
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data de criação</SelectItem>
                <SelectItem value="severity">Severidade</SelectItem>
                <SelectItem value="deadline">Prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Status chips */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {allStatuses.map(s => (
                <Button
                  key={s}
                  variant={filterStatus === s ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs min-w-[44px]"
                  onClick={() => setFilterStatus(prev => prev === s ? null : s)}
                >
                  {statusConfig[s].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Severity chips */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Severidade</p>
            <div className="flex flex-wrap gap-1.5">
              {allSeverities.map(s => (
                <Button
                  key={s}
                  variant={filterSeverity === s ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs min-w-[44px]"
                  onClick={() => setFilterSeverity(prev => prev === s ? null : s)}
                >
                  {severityConfig[s].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Category chips */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {NC_CATEGORIES.map(cat => (
                <Button
                  key={cat}
                  variant={filterCategories.includes(cat) ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs min-w-[44px]"
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={filterOverdue ? 'destructive' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1 min-w-[44px]"
              onClick={() => setFilterOverdue(prev => !prev)}
            >
              <Clock className="h-3 w-3" /> Somente vencidas
            </Button>
            <Button
              variant={filterReincident ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1 min-w-[44px]"
              onClick={() => setFilterReincident(prev => !prev)}
            >
              <RotateCcw className="h-3 w-3" /> Reincidentes
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {filtered.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhum resultado"
          description="Nenhuma NC corresponde aos filtros selecionados."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((nc) => {
            const sev = severityConfig[nc.severity];
            const st = statusConfig[nc.status];
            const isOverdue = nc.deadline && nc.deadline < today && nc.status !== 'closed';
            const reopenCount = nc.reopen_count ?? 0;
            const ncCategory = nc.category;

            const deadlineDate = nc.deadline ? parseISO(nc.deadline) : null;
            const hoursUntilDeadline = deadlineDate && nc.status !== 'closed'
              ? differenceInHours(deadlineDate, new Date())
              : null;
            const isExpiringSoon = hoursUntilDeadline !== null && hoursUntilDeadline > 0 && hoursUntilDeadline <= 48;

            return (
              <Card
                key={nc.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98] ${
                  isExpiringSoon ? 'ring-2 ring-orange-400/60 animate-pulse' : ''
                }`}
                onClick={() => onSelect(nc)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        nc.severity === 'critical' || nc.severity === 'high'
                          ? 'bg-destructive/10'
                          : 'bg-warning/10'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          nc.severity === 'critical' || nc.severity === 'high'
                            ? 'text-destructive'
                            : 'text-warning'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{nc.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded ${sev.className}`}>
                            {sev.label}
                          </span>
                          <Badge variant={st.variant} className="text-[10px] sm:text-xs">{st.label}</Badge>
                          {ncCategory && (
                            <Badge variant="outline" className="text-[10px] sm:text-xs gap-1">
                              <Tag className="h-2.5 w-2.5" />
                              {ncCategory}
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge variant="destructive" className="gap-1 text-[10px] sm:text-xs">
                              <Clock className="h-3 w-3" />
                              Atrasada
                            </Badge>
                          )}
                          {isExpiringSoon && !isOverdue && (
                            <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs border-orange-400 text-orange-600">
                              <Clock className="h-3 w-3" />
                              Vence em {Math.ceil(hoursUntilDeadline!)}h
                            </Badge>
                          )}
                          {reopenCount > 0 && (
                            <Badge
                              variant={reopenCount >= 3 ? 'destructive' : 'outline'}
                              className="gap-1 text-[10px] sm:text-xs"
                            >
                              <RotateCcw className="h-3 w-3" />
                              {reopenCount}x
                            </Badge>
                          )}
                        </div>
                        {nc.responsible_user_name && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {nc.responsible_user_name}
                          </p>
                        )}
                        {nc.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1 hidden sm:block">
                            {nc.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-1 sm:mt-0">
                      {nc.deadline && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                          {format(parseISO(nc.deadline), "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
