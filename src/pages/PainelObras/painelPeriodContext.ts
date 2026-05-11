/**
 * PainelPeriodContext — compartilha o filtro de período do Painel de Obras
 * com o conteúdo expandido das linhas (ExpandedRowContent), evitando passar
 * o bucket por toda a cadeia ObraRow / KanbanCard / Board.
 */
import { createContext, useContext } from "react";
import type { PeriodProjectBucket } from "@/hooks/usePainelPeriodActivities";

export interface PainelPeriodContextValue {
  from: string | null;
  to: string | null;
  byProject: Map<string, PeriodProjectBucket>;
  isLoading: boolean;
  /** Atualiza o intervalo do filtro de período. Datas em formato YYYY-MM-DD. */
  setRange?: (from: string | null, to: string | null) => void;
}

const Ctx = createContext<PainelPeriodContextValue>({
  from: null,
  to: null,
  byProject: new Map(),
  isLoading: false,
});

export const PainelPeriodProvider = Ctx.Provider;
export const usePainelPeriodContext = () => useContext(Ctx);
