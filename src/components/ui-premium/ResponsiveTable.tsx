/**
 * ResponsiveTable — wrapper que decide entre <table> (desktop) e
 * lista de cards (mobile) baseado no breakpoint atual.
 *
 * O componente é deliberadamente magro: ele NÃO replica todas as
 * features da `DataTable` (sort, filtros, settings). Use-o quando:
 *   - A tela mobile precisa virar lista de cards mesmo;
 *   - A tabela desktop é simples (sem sort complexo) ou já existe.
 *
 * Para tabelas grandes (PurchasesTable, CalendarioCompras, …), o
 * caminho recomendado é:
 *   <div className="hidden md:block"><TabelaDesktop /></div>
 *   <div className="md:hidden"><MobileList>...</MobileList></div>
 *
 * Esse componente automatiza esse pattern.
 */
import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveTableProps<T> {
  /** Dados (qualquer shape — render é responsabilidade do consumidor). */
  data: T[];
  /** Render do conteúdo desktop — geralmente uma <table> ou DataTable. */
  desktop: (data: T[]) => React.ReactNode;
  /** Render do conteúdo mobile — geralmente um MobileList. */
  mobile: (data: T[]) => React.ReactNode;
  /** Quando `true`, força o modo mobile mesmo em desktop (útil em testes). */
  forceMobile?: boolean;
}

export function ResponsiveTable<T>({
  data,
  desktop,
  mobile,
  forceMobile,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();
  const useMobile = forceMobile ?? isMobile;
  return <>{useMobile ? mobile(data) : desktop(data)}</>;
}
