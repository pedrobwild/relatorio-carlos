/**
 * ManagementBand — faixa gerencial ÚNICA do Painel de Obras (staff-only).
 *
 * Substitui MetricRail + ExceptionsBar por 6 tiles clicáveis que respondem
 * à pergunta "qual obra precisa de atenção HOJE?". Cada tile aplica um
 * filtro na tabela abaixo (via callback e URL param `?tile=`).
 *
 * Design tokens semânticos apenas — nenhuma cor hardcoded.
 */
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  ShieldAlert,
  UserX,
  PauseCircle,
  ClockAlert,
  type LucideIcon,
} from "lucide-react";

export type ManagementTileId =
  | "atrasadas"
  | "risco"
  | "estouro_custo"
  | "ncs_criticas"
  | "sem_responsavel"
  | "paralisadas"
  | "sem_atualizacao_72h";

export interface ManagementTile {
  id: ManagementTileId;
  label: string;
  value: number;
  hint: string;
  tone: "destructive" | "warning" | "info" | "muted";
  icon: LucideIcon;
}

interface Props {
  tiles: ManagementTile[];
  activeTile: ManagementTileId | null;
  onSelect: (id: ManagementTileId) => void;
  isLoading?: boolean;
}

const toneStyles: Record<ManagementTile["tone"], { icon: string; value: string; ring: string }> = {
  destructive: {
    icon: "text-destructive",
    value: "text-destructive",
    ring: "ring-destructive/30",
  },
  warning: {
    icon: "text-[hsl(var(--warning))]",
    value: "text-[hsl(var(--warning))]",
    ring: "ring-[hsl(var(--warning))]/30",
  },
  info: {
    icon: "text-primary",
    value: "text-foreground",
    ring: "ring-primary/30",
  },
  muted: {
    icon: "text-muted-foreground",
    value: "text-muted-foreground",
    ring: "ring-border",
  },
};

export function ManagementBand({ tiles, activeTile, onSelect, isLoading }: Props) {
  return (
    <div
      className="mb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
      role="toolbar"
      aria-label="Indicadores gerenciais do portfólio"
    >
      {tiles.map((t) => {
        const styles = toneStyles[t.tone];
        const isActive = activeTile === t.id;
        const isZero = t.value === 0;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={isActive}
            aria-label={`${t.label}: ${t.value}. ${t.hint}`}
            className={cn(
              "group text-left rounded-lg border border-border-subtle bg-card px-3 py-2.5",
              "transition-all hover:border-border hover:bg-accent/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive && `border-primary/50 bg-primary/5 ring-2 ${styles.ring}`,
              isZero && !isActive && "opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                {t.label}
              </span>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", styles.icon)} aria-hidden />
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-2xl font-semibold tabular-nums leading-none",
                  isZero ? "text-muted-foreground" : styles.value,
                )}
              >
                {isLoading ? "—" : t.value}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{t.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

export const MANAGEMENT_TILE_ICONS = {
  atrasadas: AlertTriangle,
  risco: Clock,
  estouro_custo: DollarSign,
  ncs_criticas: ShieldAlert,
  sem_responsavel: UserX,
  paralisadas: PauseCircle,
} satisfies Record<ManagementTileId, LucideIcon>;
