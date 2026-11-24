/**
 * Textos do Diário de obra que dependem das linhas do banco (obra e relato
 * já enviado). As regras da tela ficam em `regras.ts`.
 */
import type { DiarioObraOption, DiarioRelatoRow } from "@/infra/repositories/diarioObra.repository";
import { defineInicioReal, gerarTextoCliente, proximaEtapaDe, type EtapaCronograma } from "./regras";

/** "Ped. 1234 · Unid. 56" — pedido e unidade do cadastro da obra. */
export const metaDaObra = (o: Pick<DiarioObraOption, "budget_code" | "unit_name">) =>
  [o.budget_code ? `Ped. ${o.budget_code}` : null, o.unit_name ? `Unid. ${o.unit_name}` : null].filter(Boolean).join(" · ");

/** Texto do cliente gerado de novo a partir de um relato já enviado. */
export function textoGerado(relato: DiarioRelatoRow, etapas: readonly EtapaCronograma[]): string {
  return gerarTextoCliente({
    etapa: relato.description,
    status: relato.status,
    dia: relato.diario?.report_date ?? "",
    equipe: relato.diario?.team_count ?? 0,
    fotos: 1,
    pendencias: relato.pendencias,
    defineInicio: defineInicioReal(relato.marco, { status: relato.status, tipo: relato.medicao_tipo }),
    proximaEtapa: relato.item_id ? proximaEtapaDe(etapas, relato.item_id) : null,
  });
}
