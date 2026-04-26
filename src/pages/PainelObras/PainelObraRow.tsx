/**
 * Linha individual da tabela do Painel.
 *
 * Substitui a expansão inline antiga por um clique no nome (ou na seta) que
 * dispara `onOpenDetail` — o painel de detalhe vira um Sheet ao lado.
 */
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ExternalBudgetCell } from '@/components/admin/painel/ExternalBudgetCell';
import { cn } from '@/lib/utils';
import {
  ETAPA_OPTIONS,
  RELACIONAMENTO_OPTIONS,
  STATUS_OPTIONS,
  type PainelEtapa,
  type PainelObra,
  type PainelObraPatch,
  type PainelRelacionamento,
  type PainelStatus,
} from '@/hooks/usePainelObras';
import { DateCell } from './DateCell';
import {
  NONE,
  computeDisplayStatus,
  fmtDate,
  fmtDateTime,
  relacionamentoPillClass,
  statusDotClass,
  statusPillClass,
} from './types';

interface PainelObraRowProps {
  obra: PainelObra;
  isSelected: boolean;
  onToggleSelected: () => void;
  onUpdate: (patch: PainelObraPatch) => void;
  onOpenDetail: () => void;
  onOpenObra: () => void;
  onDeleteRequest: () => void;
}

export function PainelObraRow({
  obra,
  isSelected,
  onToggleSelected,
  onUpdate,
  onOpenDetail,
  onOpenObra,
  onDeleteRequest,
}: PainelObraRowProps) {
  const stickyBase = 'bg-card group-hover:bg-accent/40 transition-colors';
  const displayStatus = computeDisplayStatus(obra);
  const isAuto = displayStatus === 'Atrasado' && obra.status !== 'Atrasado';
  const autoHint =
    'Atraso automático: Entrega Oficial vencida sem Entrega Real preenchida. ' +
    (obra.status ? `Valor salvo: "${obra.status}".` : 'Nenhum status salvo.');

  return (
    <TableRow
      className={cn(
        'group transition-colors hover:bg-accent/40',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
    >
      {/* Checkbox de seleção */}
      <TableCell className={cn('sticky left-0 z-10 w-10', stickyBase, isSelected && 'bg-primary/5')}>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelected}
            aria-label={`Selecionar ${obra.nome}`}
          />
        </div>
      </TableCell>

      {/* Cliente / Obra — sticky */}
      <TableCell
        className={cn(
          'sticky left-10 z-10 border-r border-border shadow-[1px_0_0_0_hsl(var(--border))]',
          stickyBase,
          isSelected && 'bg-primary/5',
        )}
      >
        <div className="flex items-start gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onOpenDetail}
            aria-label="Abrir detalhe"
            className="h-6 w-6 shrink-0 mt-0.5 text-muted-foreground hover:text-primary hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={onOpenDetail}
            className="text-left flex flex-col gap-0.5 flex-1 min-w-0 group/link focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-0.5"
            title="Abrir detalhe"
          >
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate group-hover/link:text-primary transition-colors">
                {obra.customer_name ?? 'Sem cliente'}
              </span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </span>
            <span className="text-xs text-muted-foreground truncate">{obra.nome}</span>
          </button>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="min-w-[120px]">
        <Select
          value={obra.status ?? NONE}
          onValueChange={(v) => onUpdate({ status: v === NONE ? null : (v as PainelStatus) })}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <SelectTrigger
                className={cn(
                  'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start gap-1.5 rounded-md',
                  statusPillClass(displayStatus),
                )}
                aria-label={isAuto ? autoHint : undefined}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDotClass(displayStatus))} />
                <span className="font-medium truncate">{displayStatus ?? 'Definir'}</span>
                {isAuto && <AlertTriangle className="h-3 w-3 opacity-70 shrink-0" aria-hidden />}
              </SelectTrigger>
            </TooltipTrigger>
            {isAuto && <TooltipContent side="top" className="max-w-[280px] text-xs">{autoHint}</TooltipContent>}
          </Tooltip>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(s))} />
                  {s}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Etapa */}
      <TableCell className="min-w-[140px]">
        <Select
          value={obra.etapa ?? NONE}
          onValueChange={(v) => onUpdate({ etapa: v === NONE ? null : (v as PainelEtapa) })}
        >
          <SelectTrigger
            className={cn(
              'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 hover:bg-accent/60 [&>svg]:opacity-40 [&>svg]:ml-1',
              !obra.etapa && 'text-muted-foreground italic',
              obra.etapa === 'Finalizada' && 'text-success font-medium',
              obra.etapa === 'Vistoria reprovada' && 'text-destructive font-medium',
            )}
          >
            <span className="truncate">{obra.etapa ?? 'Definir…'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhuma)</SelectItem>
            {ETAPA_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>
                <span
                  className={cn(
                    e === 'Finalizada' && 'text-success font-medium',
                    e === 'Vistoria reprovada' && 'text-destructive font-medium',
                  )}
                >
                  {e}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Responsável */}
      <TableCell className="text-muted-foreground">
        <span className="truncate block">
          {obra.engineer_name ?? <span className="italic">—</span>}
        </span>
      </TableCell>

      {/* Progresso */}
      <TableCell className="text-right">
        {obra.progress_percentage != null ? (
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  obra.progress_percentage >= 100 ? 'bg-success' : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, obra.progress_percentage)}%` }}
              />
            </div>
            <span
              className={cn(
                'text-xs tabular-nums w-9 text-right',
                obra.progress_percentage >= 100 && 'text-success font-semibold',
              )}
            >
              {obra.progress_percentage}%
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>

      {/* Datas */}
      <TableCell>
        <DateCell
          value={obra.inicio_oficial}
          onChange={(v) => onUpdate({ inicio_oficial: v })}
          confirmEdit
          confirmTitle="Alterar início oficial?"
        />
      </TableCell>
      <TableCell>
        <DateCell
          value={obra.entrega_oficial}
          onChange={(v) => onUpdate({ entrega_oficial: v })}
          confirmEdit
          confirmTitle="Alterar entrega oficial?"
        />
      </TableCell>
      <TableCell>
        <DateCell value={obra.inicio_real} onChange={(v) => onUpdate({ inicio_real: v })} />
      </TableCell>
      <TableCell>
        <DateCell value={obra.entrega_real} onChange={(v) => onUpdate({ entrega_real: v })} />
      </TableCell>

      {/* Relacionamento */}
      <TableCell className="min-w-[110px]">
        <Select
          value={obra.relacionamento ?? NONE}
          onValueChange={(v) =>
            onUpdate({ relacionamento: v === NONE ? null : (v as PainelRelacionamento) })
          }
        >
          <SelectTrigger
            className={cn(
              'h-7 w-fit max-w-full text-xs border-0 shadow-none px-2 py-0 [&>svg]:hidden justify-start rounded-md',
              relacionamentoPillClass(obra.relacionamento),
            )}
          >
            <span className="font-medium truncate">{obra.relacionamento ?? 'Definir'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(nenhum)</SelectItem>
            {RELACIONAMENTO_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Orçamento público */}
      <TableCell>
        <ExternalBudgetCell
          value={obra.external_budget_id}
          onChange={(id) => onUpdate({ external_budget_id: id })}
        />
      </TableCell>

      {/* Última atualização */}
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-default tabular-nums">
              {fmtDate(obra.ultima_atualizacao)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{fmtDateTime(obra.ultima_atualizacao)}</TooltipContent>
        </Tooltip>
      </TableCell>

      {/* Ações sticky */}
      <TableCell
        className={cn(
          'sticky right-0 z-10 border-l border-border',
          stickyBase,
          isSelected && 'bg-primary/5',
        )}
      >
        <div className="flex items-center justify-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={onOpenObra}
                aria-label="Abrir obra"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Abrir obra</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    aria-label="Mais ações"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">Mais ações</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onOpenObra} className="text-xs gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir obra
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenDetail} className="text-xs gap-2">
                <ChevronRight className="h-3.5 w-3.5" />
                Abrir painel lateral
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteRequest}
                className="text-xs gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir obra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
