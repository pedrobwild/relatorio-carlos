/**
 * Barra flutuante que aparece quando há obras selecionadas.
 *
 * Operações em massa:
 *  - Mudar status (Select)
 *  - Reatribuir engenheiro responsável (Select com lista de engenheiros)
 *  - Exportar CSV das obras selecionadas
 *
 * Persistência via `useMutation` em batch — cada chamada é independente,
 * mas o callback `onBatchUpdate` agrupa o resultado pra mostrar 1 só toast.
 */
import { useMutation } from '@tanstack/react-query';
import { Download, UserCog, Loader2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  STATUS_OPTIONS,
  type PainelObra,
  type PainelObraPatch,
  type PainelStatus,
} from '@/hooks/usePainelObras';
import { computeDisplayStatus, fmtDate, statusDotClass } from './types';

interface PainelBulkBarProps {
  selectedIds: string[];
  selectedCount: number;
  selectedObras: PainelObra[];
  /** Lista de engenheiros disponíveis (id + nome). */
  engineers: { id: string; name: string }[];
  /** Persiste um patch numa obra individual; chamado pra cada item da seleção. */
  applyPatch: (id: string, patch: PainelObraPatch) => Promise<void> | void;
  onClear: () => void;
}

export function PainelBulkBar({
  selectedIds,
  selectedCount,
  selectedObras,
  engineers,
  applyPatch,
  onClear,
}: PainelBulkBarProps) {
  const statusMutation = useMutation({
    mutationFn: async (status: PainelStatus) => {
      await Promise.all(selectedIds.map((id) => applyPatch(id, { status })));
    },
    onSuccess: (_, status) => {
      toast.success(`${selectedCount} obra(s) marcada(s) como "${status}".`);
      onClear();
    },
    onError: () => toast.error('Não foi possível atualizar todas as obras. Tente novamente.'),
  });

  // Reatribuir engenheiro: hoje a tabela `projects` armazena `engineer_id` e o
  // hook `usePainelObras` já conhece o nome via join. Nem todos os schemas
  // expõem essa coluna no patch tipado — caso futuro, basta adicionar no
  // `PainelObraPatch`. Por enquanto a ação é entregue via callback custom.
  const handleAssignEngineer = (engineerId: string, engineerName: string) => {
    toast.message('Reatribuir engenheiro', {
      description:
        `Função preparada para ${selectedCount} obra(s) → "${engineerName}". ` +
        'A persistência do engineer_id em massa entra no próximo PR.',
    });
    // Hook futuro: applyPatch(id, { engineer_id: engineerId })
    void engineerId;
  };

  const handleExportCsv = () => {
    if (selectedObras.length === 0) return;
    const csv = buildCsv(selectedObras);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `painel-obras-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`CSV com ${selectedObras.length} obra(s) baixado.`);
  };

  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none',
        'animate-in fade-in slide-in-from-bottom-2 duration-150',
      )}
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg px-3 py-2 max-w-[calc(100vw-2rem)]">
        <span className="text-xs font-semibold text-foreground tabular-nums px-1">
          {selectedCount} selecionada(s)
        </span>

        {/* Status em massa */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-info" />
              )}
              Mudar status
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
              Aplicar a {selectedCount} obra(s)
            </DropdownMenuLabel>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s}
                className="text-xs gap-2"
                onClick={() => statusMutation.mutate(s)}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reatribuir engenheiro */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <UserCog className="h-3.5 w-3.5" />
              Reatribuir engenheiro
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
              Aplicar a {selectedCount} obra(s)
            </DropdownMenuLabel>
            {engineers.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs italic">
                Nenhum engenheiro disponível
              </DropdownMenuItem>
            ) : (
              engineers.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  className="text-xs"
                  onClick={() => handleAssignEngineer(e.id, e.name)}
                >
                  {e.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-[10px] italic text-muted-foreground">
              Persistência via Supabase entra no próximo PR
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export CSV */}
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 ml-1 text-muted-foreground"
          onClick={onClear}
          aria-label="Limpar seleção"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function buildCsv(rows: PainelObra[]): string {
  const headers = [
    'ID',
    'Cliente',
    'Obra',
    'Status',
    'Etapa',
    'Responsavel',
    'Progresso',
    'Inicio Oficial',
    'Entrega Oficial',
    'Inicio Real',
    'Entrega Real',
    'Relacionamento',
    'Atualizado em',
  ];
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = rows.map((o) =>
    [
      o.id,
      o.customer_name,
      o.nome,
      computeDisplayStatus(o),
      o.etapa,
      o.engineer_name,
      o.progress_percentage,
      fmtDate(o.inicio_oficial),
      fmtDate(o.entrega_oficial),
      fmtDate(o.inicio_real),
      fmtDate(o.entrega_real),
      o.relacionamento,
      fmtDate(o.ultima_atualizacao),
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}
