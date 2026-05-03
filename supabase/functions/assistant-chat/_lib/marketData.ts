// Fetchers para fontes externas estruturadas (api_official | api_aggregator).
//
// Faz a chamada HTTP, normaliza a resposta, devolve um objeto pequeno e
// tipado para o orquestrador montar a evidência. Cache fica fora deste
// módulo (ver _shared/externalCache.ts).

import { ExternalSource, findExternalSource } from "./externalSources.ts";

export interface MarketDataResult {
  source_id: string;
  /** dados brutos da fonte (já decodificados de JSON) */
  raw: unknown;
  /** resumo curto p/ Researcher gerar `claim` sem alucinar */
  summary: string;
  /** valor numérico canônico se a fonte é numérica de série única */
  numeric_value?: number;
  numeric_unit?: string;
  /** data do dado mais recente devolvido (ISO ou null) */
  latest_at?: string | null;
  url: string;
  publisher: string;
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchJSON(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} em ${url}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * BCB SGS — formato { data: "DD/MM/YYYY", valor: "11.25" }[].
 * `n` = quantos pontos retornar (default 1).
 */
async function fetchBcbSeries(
  source: ExternalSource,
  params: { n?: number },
): Promise<MarketDataResult> {
  const n = Math.max(1, Math.min(60, Number(params.n ?? 1)));
  const url = source.endpoint!.replace("{n}", String(n));
  const arr = (await fetchJSON(url)) as Array<{ data: string; valor: string }>;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`BCB SGS sem dados para ${source.id}`);
  }
  const last = arr[arr.length - 1];
  const numeric = Number(last.valor);
  const [d, m, y] = (last.data || "").split("/");
  const latestAt = y && m && d ? `${y}-${m}-${d}` : null;
  const unit = source.id === "bcb_cambio_usd" ? "R$" : "%";
  const seriesLabel = source.name;
  const summary = arr.length === 1
    ? `${seriesLabel}: ${last.valor} (${last.data})`
    : `${seriesLabel}: ${arr.length} pontos, mais recente ${last.valor} em ${last.data}`;

  return {
    source_id: source.id,
    raw: arr,
    summary,
    numeric_value: Number.isFinite(numeric) ? numeric : undefined,
    numeric_unit: unit,
    latest_at: latestAt,
    url,
    publisher: "Banco Central do Brasil (SGS)",
  };
}

/**
 * Receita Federal — publica.cnpj.ws — devolve cadastro completo.
 * params.cnpj é obrigatório (somente dígitos).
 */
async function fetchCnpjReceita(
  source: ExternalSource,
  params: { cnpj?: string },
): Promise<MarketDataResult> {
  const cnpj = (params.cnpj ?? "").toString().replace(/\D/g, "");
  if (cnpj.length !== 14) {
    throw new Error("cnpj deve ter 14 dígitos");
  }
  const url = source.endpoint!.replace("{cnpj}", cnpj);
  const data = (await fetchJSON(url)) as Record<string, unknown> & {
    razao_social?: string;
    estabelecimento?: {
      situacao_cadastral?: string;
      nome_fantasia?: string;
      atividade_principal?: { descricao?: string };
      data_situacao_cadastral?: string;
    };
  };
  const est = data.estabelecimento ?? {};
  const status = est.situacao_cadastral ?? "desconhecida";
  const nome = data.razao_social ?? est.nome_fantasia ?? `CNPJ ${cnpj}`;
  const atividade = est.atividade_principal?.descricao ?? "—";
  const summary =
    `${nome} — situação: ${status} · atividade: ${atividade}`;

  return {
    source_id: source.id,
    raw: data,
    summary,
    latest_at: est.data_situacao_cadastral ?? null,
    url,
    publisher: "Receita Federal (publica.cnpj.ws)",
  };
}

/**
 * Dispatcher — escolhe o fetcher pelo source.id / kind.
 * Lança erro descritivo para o orquestrador degradar o step.
 */
export async function fetchMarketData(
  sourceId: string,
  params: Record<string, unknown>,
): Promise<MarketDataResult> {
  const source = findExternalSource(sourceId);
  if (!source) throw new Error(`source desconhecida: ${sourceId}`);
  if (source.kind !== "api_official" && source.kind !== "api_aggregator") {
    throw new Error(
      `source ${sourceId} é ${source.kind}; use web_research em vez de fetch_market_data`,
    );
  }

  if (sourceId.startsWith("bcb_")) {
    return fetchBcbSeries(source, params as { n?: number });
  }
  if (sourceId === "cnpj_receita") {
    return fetchCnpjReceita(source, params as { cnpj?: string });
  }

  throw new Error(`fetcher não implementado para ${sourceId}`);
}
