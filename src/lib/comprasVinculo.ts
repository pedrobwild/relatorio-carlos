/**
 * Regras de tela da conciliação Compras ↔ Workflow.
 *
 * Importante: nada aqui escolhe obra sozinho. A busca só filtra a lista pelo
 * que a pessoa digitou; quem decide o vínculo é sempre uma pessoa, uma obra
 * por vez.
 */
import type {
  ComprasObraVinculo,
  ComprasVinculoStatus,
  ObraWorkflowOpcao,
} from "@/infra/repositories/comprasSync.repository";

export const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "Maria Silva · Itaim · 112" */
export function nomeDaObraNoCompras(
  v: Pick<ComprasObraVinculo, "cliente" | "empreendimento" | "unidade">,
): string {
  return [v.cliente, v.empreendimento, v.unidade].filter(Boolean).join(" · ");
}

/** "Obra Itaim 112 · Unid. 112 · Maria Silva" */
export function nomeDaObraNoWorkflow(o: ObraWorkflowOpcao): string {
  return [o.name, o.unit_name ? `Unid. ${o.unit_name}` : null, o.customer_name]
    .filter(Boolean)
    .join(" · ");
}

/** Filtra as obras do Workflow pelo texto digitado (todas as palavras). */
export function buscarObras(obras: ObraWorkflowOpcao[], busca: string): ObraWorkflowOpcao[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return obras;
  return obras.filter((o) => {
    const alvo = semAcento(nomeDaObraNoWorkflow(o));
    return termos.every((t) => alvo.includes(t));
  });
}

export function contarPorStatus(
  vinculos: ComprasObraVinculo[],
): Record<ComprasVinculoStatus, number> {
  const total: Record<ComprasVinculoStatus, number> = { pendente: 0, confirmado: 0, ignorado: 0 };
  for (const v of vinculos) total[v.status] += 1;
  return total;
}

/** Obras do Workflow que já estão vinculadas a OUTRA obra do Compras. */
export function obrasJaVinculadas(
  vinculos: ComprasObraVinculo[],
  exceto?: string,
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const v of vinculos) {
    if (v.status === "confirmado" && v.project_id && v.id !== exceto) {
      mapa.set(v.project_id, nomeDaObraNoCompras(v));
    }
  }
  return mapa;
}

/** "há 3 min", "há 2 h", "há 4 dias" */
export function haQuanto(iso: string | null | undefined, agora: Date = new Date()): string {
  if (!iso) return "nunca";
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** A cópia está velha? (o agendamento roda a cada 5 min) */
export function copiaAtrasada(iso: string | null | undefined, agora: Date = new Date()): boolean {
  if (!iso) return true;
  return agora.getTime() - new Date(iso).getTime() > 20 * 60000;
}
