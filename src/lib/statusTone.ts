/**
 * statusTone — Mapeamento centralizado PainelStatus → StatusTone semântico.
 *
 * Use junto com `<StatusBadge tone={getStatusTone(status)}>` ou para resolver
 * a cor do dot indicador (`bg-${tone}` via util do design system).
 *
 * Bloco 3 (Design System): centralizar a decisão "qual cor para qual status"
 * em um único lugar para que dark mode, branding e acessibilidade fiquem
 * consistentes em todas as telas.
 *
 * Para outros domínios (orçamento, fornecedor, severidade, etc.) ver
 * `src/lib/statusTones.ts` (mapas por domínio + getTone helper).
 */
import type { StatusTone } from '@/components/ui-premium';
import type { PainelStatus } from '@/hooks/usePainelObras';

/**
 * Mapeamento canônico para `PainelStatus` (status de obra).
 *
 * - Aguardando → info     (em andamento, esperando algo)
 * - Em dia     → success  (no prazo, ok)
 * - Atrasado   → danger   (fora do prazo, requer ação)
 * - Paralisada → muted    (pausada, sem movimento)
 */
export const PAINEL_STATUS_TONE: Record<PainelStatus, StatusTone> = {
  Aguardando: 'info',
  'Em dia': 'success',
  Atrasado: 'danger',
  Paralisada: 'muted',
};

/**
 * Aliases para strings legadas / variantes de status que aparecem em outras
 * telas (ex: PainelObras pode receber "Em andamento" vindo de um status mais
 * antigo). Mantém a mesma intenção semântica.
 */
const STATUS_ALIAS_TONE: Record<string, StatusTone> = {
  'Em andamento': 'info',
  Pausado: 'muted',
  'Aguardando cliente': 'warning',
  Concluído: 'success',
  Concluida: 'success',
  Concluída: 'success',
  'Não iniciado': 'neutral',
  'Nao iniciado': 'neutral',
  Finalizada: 'success',
};

/**
 * Resolve o tom semântico para um status de obra.
 *
 * Aceita `PainelStatus` (tipado) ou strings ad-hoc — útil em telas que
 * recebem o status como string genérica (kanban, filtros, badges em
 * tabelas).
 *
 * @param status  status do painel ou string equivalente
 * @param fallback tom usado quando o status é nulo/desconhecido (default: neutral)
 */
export function getStatusTone(
  status: PainelStatus | string | null | undefined,
  fallback: StatusTone = 'neutral',
): StatusTone {
  if (!status) return fallback;
  if (status in PAINEL_STATUS_TONE) {
    return PAINEL_STATUS_TONE[status as PainelStatus];
  }
  return STATUS_ALIAS_TONE[status] ?? fallback;
}

/**
 * Classe Tailwind do dot indicador para um status — atalho equivalente a
 * `bg-${tone}` resolvido via `getStatusTone`. Usado em pills inline e
 * cabeçalhos de coluna de kanban onde StatusBadge seria pesado demais.
 */
const DOT_BY_TONE: Record<StatusTone, string> = {
  neutral: 'bg-muted',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground',
};

export function getStatusDotClass(
  status: PainelStatus | string | null | undefined,
): string {
  return DOT_BY_TONE[getStatusTone(status)];
}
