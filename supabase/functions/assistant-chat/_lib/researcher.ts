// Researcher — camada fina entre o resultado bruto da fonte externa
// (Perplexity / API estruturada) e o fact pack do Analyst.
//
// Responsabilidades:
//   1. Esquema rígido de `ExternalEvidence` (URL, data, verbatim_quote, tier).
//   2. Validação automática (warnings + fail).
//   3. Conversão de MarketDataResult → ExternalEvidence (caminho determinístico
//      para fontes estruturadas — não passa pelo LLM).

import { findExternalSource, ExternalSource } from "./externalSources.ts";
import type { MarketDataResult } from "./marketData.ts";

/** Hierarquia de fontes — Tier 1 prevalece em conflito. */
export type Tier = 1 | 2 | 3 | 4;

export interface ExternalEvidence {
  source_id: string;
  /** afirmação curta em PT-BR */
  claim: string;
  numeric_value: number | null;
  numeric_unit: string | null;
  url: string;
  publisher: string;
  /** ISO date — quando consultamos */
  access_date: string;
  /** ISO date — quando o publicador divulgou (null se desconhecido) */
  published_at: string | null;
  tier: Tier;
  confidence: "high" | "medium" | "low";
  /** trecho LITERAL de até 25 palavras */
  verbatim_quote: string;
  warnings: string[];
}

export interface ResearcherValidation {
  valid: boolean;
  issues: string[];
}

const SOURCE_TIER_OVERRIDES: Record<string, Tier> = {
  bcb_selic: 1,
  bcb_ipca: 1,
  bcb_incc_m: 1,
  bcb_cambio_usd: 1,
  cnpj_receita: 1,
  cub_sp: 1,
  sinduscon_salarios: 1,
  short_stay_lei_sp: 1,
  alvara_sp: 1,
  noticias_construcao: 2,
  inside_airbnb_sp: 2,
  mercado_aluguel_bairro: 3,
  reclame_aqui: 3,
  tjsp_processos: 3,
};

export function tierFor(sourceId: string): Tier {
  return SOURCE_TIER_OVERRIDES[sourceId] ?? 3;
}

/**
 * Converte um MarketDataResult em ExternalEvidence.
 * Determinístico — não passa por LLM.
 */
export function evidenceFromMarketData(
  m: MarketDataResult,
): ExternalEvidence {
  const accessDate = new Date().toISOString().slice(0, 10);
  const tier = tierFor(m.source_id);
  const warnings: string[] = [];
  if (!m.latest_at) warnings.push("data_publicacao_desconhecida");

  const verbatim = m.summary.length > 200
    ? m.summary.slice(0, 200) + "…"
    : m.summary;

  return {
    source_id: m.source_id,
    claim: m.summary,
    numeric_value: typeof m.numeric_value === "number" ? m.numeric_value : null,
    numeric_unit: m.numeric_unit ?? null,
    url: m.url,
    publisher: m.publisher,
    access_date: accessDate,
    published_at: m.latest_at ?? null,
    tier,
    confidence: tier === 1 ? "high" : tier === 2 ? "medium" : "low",
    verbatim_quote: verbatim,
    warnings,
  };
}

/**
 * Valida uma ExternalEvidence (vinda do LLM/Perplexity ou de qualquer caminho).
 * Issues conhecidos: sem_url, sem_data_acesso, claim_numerico_sem_valor,
 * dado_potencialmente_desatualizado.
 */
export function validateExternalEvidence(
  e: ExternalEvidence,
): ResearcherValidation {
  const issues: string[] = [];
  if (!e.url) issues.push("sem_url");
  if (!e.access_date) issues.push("sem_data_acesso");
  if (e.numeric_value !== null && !Number.isFinite(e.numeric_value)) {
    issues.push("numeric_value_invalido");
  }

  const source = findExternalSource(e.source_id);
  if (source && e.published_at) {
    const ageH = hoursSince(e.published_at);
    if (source.recency === "daily" && ageH > 72) {
      issues.push("dado_potencialmente_desatualizado");
    }
    if (source.recency === "weekly" && ageH > 24 * 14) {
      issues.push("dado_potencialmente_desatualizado");
    }
  }

  return { valid: issues.length === 0, issues };
}

function hoursSince(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3_600_000;
}

/**
 * System prompt do Researcher — usado quando convertemos resultado bruto
 * da Perplexity em `ExternalEvidence`. Schema rígido evita alucinação.
 */
export const RESEARCHER_SYSTEM_PROMPT =
  `Você é o **Researcher** do Assistente BWild. Sua tarefa: receber resultado bruto de uma pesquisa externa (Perplexity, API, scraping) e extrair UMA evidência estruturada e validada.

# Saída obrigatória (chamar a tool extract_evidence)

{
  "source_id": "id de EXTERNAL_SOURCES",
  "claim": "afirmação curta em PT-BR — o fato extraído",
  "numeric_value": número | null,
  "numeric_unit": "%" | "R$" | "horas" | "m²" | "" | null,
  "url": "URL canônica da fonte (string obrigatória)",
  "publisher": "nome do publicador (BCB, G1, Sinduscon...)",
  "access_date": "ISO date — quando você consultou",
  "published_at": "ISO date — quando o publicador divulgou (null se desconhecido)",
  "tier": 1 | 2 | 3 | 4,
  "confidence": "high | medium | low",
  "verbatim_quote": "trecho LITERAL de até 25 palavras que sustenta o claim",
  "warnings": ["potencialmente_desatualizado", "fonte_secundaria_sem_corroboracao"]
}

# Regras

1. **Nunca afirme número que não está literalmente no resultado.** Se a pesquisa não trouxe número claro, "numeric_value": null e "claim" é qualitativa ("subiu", "estável").
2. **"url" obrigatória.** Se não houver URL no resultado, "source_id" recebe sufixo "_unverified" e "tier": 4.
3. **"verbatim_quote" é literal.** Sem paráfrase. Se o trecho original tem mais de 25 palavras, escolha a substring mais relevante.
4. **"tier"** segue: 1=oficial (.gov.br/BCB/Sinduscon), 2=secundário (Globo/Estadão/Folha/Valor), 3=agregador (Reclame Aqui/JusBrasil/QuintoAndar), 4=não verificável.
5. **Em conflito**, escolha Tier mais alto. Se conflito Tier 1, devolva DUAS evidências (não escolha sozinho).
6. **Datas**: se a pesquisa não traz "published_at", vale null e adiciona warning "data_publicacao_desconhecida".
7. **Idioma**: "claim" em PT-BR. Não traduza dado numérico.

# O que NÃO fazer

- Inventar fonte ("segundo dados do mercado") sem URL específica.
- Usar conhecimento do treinamento ("sei que a Selic está em X") para preencher lacuna do resultado bruto.
- Citar publicação genérica ("Sinduscon" sem URL específica do PDF/release).
- Combinar duas fontes numa só evidência. Cada chamada extrai UMA evidência.`;

/** Schema da tool que o LLM Researcher precisa chamar. */
export const EXTRACT_EVIDENCE_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_evidence",
    description:
      "Extrai UMA evidência estruturada do resultado bruto da pesquisa.",
    parameters: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        claim: { type: "string" },
        numeric_value: { type: ["number", "null"] },
        numeric_unit: { type: ["string", "null"] },
        url: { type: "string" },
        publisher: { type: "string" },
        access_date: { type: "string" },
        published_at: { type: ["string", "null"] },
        tier: { type: "integer", enum: [1, 2, 3, 4] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        verbatim_quote: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: [
        "source_id",
        "claim",
        "url",
        "publisher",
        "access_date",
        "tier",
        "confidence",
        "verbatim_quote",
        "warnings",
      ],
      additionalProperties: false,
    },
  },
};

export type { ExternalSource };
