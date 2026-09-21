/**
 * Formata um `Date` como `yyyy-MM-dd` no fuso LOCAL do aparelho.
 *
 * `date.toISOString().slice(0, 10)` devolve a data em UTC: no Brasil (UTC-3),
 * depois das 21h isso grava o DIA SEGUINTE em colunas `date` (início real de
 * atividade, recebimento, prazo calculado). Use esta função para qualquer
 * data "de calendário" que venha de um `Date` local.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
