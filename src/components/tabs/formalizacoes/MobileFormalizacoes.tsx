import { FileText, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SummaryChips, FiltersSheet, type SummaryChip } from '@/components/ui-premium';
import { FORMALIZATION_TYPE_LABELS } from '@/types/formalization';
import { FormalizacaoCard, FormalizacaoSkeleton } from './FormalizacaoCard';

interface MobileFormalizacoesProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formalizacoes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allFormalizacoes: any[];
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  pendingCount: number;
  signedCount: number;
  basePath: string;
}

export function MobileFormalizacoes({
  formalizacoes,
  allFormalizacoes,
  isLoading,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  pendingCount,
  signedCount,
  basePath,
}: MobileFormalizacoesProps) {
  const totalCount = allFormalizacoes.length;
  const activeFilterCount =
    (searchTerm.trim().length > 0 ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

  const chips: SummaryChip[] = [
    { id: 'pendentes', label: 'Pendentes', count: pendingCount, accent: 'warning' },
    { id: 'finalizadas', label: 'Finalizadas', count: signedCount, accent: 'success' },
    { id: 'todas', label: 'Todas', count: totalCount, accent: 'primary' },
  ];

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  return (
    <div className="lg:hidden space-y-3">
      <SummaryChips
        ariaLabel="Filtrar formalizações"
        chips={chips}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id ?? 'todas')}
      />

      <div className="flex">
        <FiltersSheet
          activeCount={activeFilterCount}
          onClear={handleClearFilters}
          title="Filtros de formalizações"
        >
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Buscar
            </label>
            <Input
              placeholder="Buscar formalizações…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar formalizações"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Tipo
            </label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Filtrar por tipo">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(FORMALIZATION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FiltersSheet>
      </div>

      <div className="space-y-3 pt-1">
        {isLoading ? (
          [1, 2, 3].map((i) => <FormalizacaoSkeleton key={i} />)
        ) : formalizacoes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                {activeTab === 'pendentes' ? (
                  <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                )}
              </div>
              <p className="font-medium text-foreground">
                {activeTab === 'pendentes'
                  ? 'Nenhuma pendência'
                  : 'Nenhuma formalização encontrada'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === 'pendentes'
                  ? 'Você está em dia com todas as formalizações.'
                  : 'Ajuste os filtros ou crie uma nova formalização.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          formalizacoes.map((f, i) => (
            <FormalizacaoCard
              key={f.id}
              formalizacao={f}
              basePath={basePath}
              index={i}
              showStatusLabel={false}
            />
          ))
        )}
      </div>
    </div>
  );
}
