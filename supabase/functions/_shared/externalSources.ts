// Catálogo de fontes EXTERNAS (mercado, regulação, fornecedor) — v4.
//
// Filosofia: espelho do CATALOG/DERIVATIONS, mas para "fora". O LLM consulta
// este catálogo para saber O QUE pode pesquisar e COMO. Sem catálogo, ele
// inventa fonte ("segundo o Sinduscon de 2023…") — alucinação clássica.
//
// IDs são estáveis: o Planner os referencia em `external_source_id`,
// o cache os usa como chave, o Researcher valida contra eles.

export type SourceKind =
  | "api_official"
  | "api_aggregator"
  | "web_search"
  | "web_scrape"
  | "internal_dataset";

export type Confidence = "high" | "medium" | "low";

export type Recency = "realtime" | "daily" | "weekly" | "monthly" | "static";

export interface ExternalSource {
  id: string;
  name: string;
  category:
    | "macro"
    | "construcao"
    | "imobiliario"
    | "fornecedor"
    | "regulatorio"
    | "noticia";
  description: string;
  kind: SourceKind;
  /** URL com placeholders {param} — só para api_official | api_aggregator | web_scrape. */
  endpoint?: string;
  /** Domínios sugeridos quando kind=web_search (filtra a busca da Perplexity). */
  perplexity_focus?: string[];
  cache_ttl_hours: number;
  confidence: Confidence;
  recency: Recency;
  example_question: string;
  cost_estimate: "free" | "cheap" | "expensive";
}

export const EXTERNAL_SOURCES: ExternalSource[] = [
  // ============ MACRO (BCB SGS — API pública gratuita) ============
  {
    id: "bcb_selic",
    name: "Taxa Selic",
    category: "macro",
    description:
      "Taxa básica de juros. Custo de capital e comparação de investimento.",
    kind: "api_official",
    endpoint:
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/{n}?formato=json",
    cache_ttl_hours: 24,
    confidence: "high",
    recency: "daily",
    example_question:
      "A Selic atual justifica o cliente parar de investir em reforma?",
    cost_estimate: "free",
  },
  {
    id: "bcb_ipca",
    name: "IPCA",
    category: "macro",
    description:
      "Inflação oficial. Reajuste contratual, comparação real de custo.",
    kind: "api_official",
    endpoint:
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/{n}?formato=json",
    cache_ttl_hours: 168,
    confidence: "high",
    recency: "monthly",
    example_question:
      "Quanto teria sido o reajuste real do contrato pelo IPCA dos últimos 12 meses?",
    cost_estimate: "free",
  },
  {
    id: "bcb_incc_m",
    name: "INCC-M (FGV)",
    category: "construcao",
    description:
      "Índice Nacional de Custo da Construção — referência canônica para reajuste de obra.",
    kind: "api_official",
    endpoint:
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.192/dados/ultimos/{n}?formato=json",
    cache_ttl_hours: 168,
    confidence: "high",
    recency: "monthly",
    example_question:
      "Pelo INCC, quanto a obra de R$ 200k assinada há 8 meses estaria custando hoje?",
    cost_estimate: "free",
  },
  {
    id: "bcb_cambio_usd",
    name: "Câmbio USD/BRL",
    category: "macro",
    description:
      "Dólar comercial PTAX. Crítico para itens importados (louças, eletros, automação).",
    kind: "api_official",
    endpoint:
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/{n}?formato=json",
    cache_ttl_hours: 1,
    confidence: "high",
    recency: "daily",
    example_question:
      "Com dólar a R$ 6, quanto pode subir o custo dos itens importados das obras em curso?",
    cost_estimate: "free",
  },

  // ============ CONSTRUÇÃO CIVIL ============
  {
    id: "cub_sp",
    name: "CUB-SP por categoria",
    category: "construcao",
    description:
      "Custo Unitário Básico de São Paulo (Sinduscon-SP). Referência R$/m². Sem API pública — pesquisar via Perplexity.",
    kind: "web_search",
    perplexity_focus: ["sindusconsp.com.br", "cbic.org.br", "cub.org.br"],
    cache_ttl_hours: 168,
    confidence: "medium",
    recency: "monthly",
    example_question:
      "Nosso ticket médio por m² está acima ou abaixo do CUB residencial alto-padrão de SP?",
    cost_estimate: "cheap",
  },
  {
    id: "sinduscon_salarios",
    name: "Pesquisa salarial Sinduscon-SP",
    category: "construcao",
    description:
      "Salário base e benefícios da convenção coletiva da construção em SP.",
    kind: "web_search",
    perplexity_focus: ["sindusconsp.com.br", "sinduscon.org.br"],
    cache_ttl_hours: 720,
    confidence: "medium",
    recency: "monthly",
    example_question:
      "A diária que pagamos a pedreiros está em linha com o piso da convenção?",
    cost_estimate: "cheap",
  },

  // ============ IMOBILIÁRIO / SHORT-STAY ============
  {
    id: "inside_airbnb_sp",
    name: "Inside Airbnb — São Paulo",
    category: "imobiliario",
    description:
      "Dataset público mensal com listings, ADR, ocupação por bairro. Útil para validar tese de short-stay.",
    kind: "web_scrape",
    endpoint: "http://insideairbnb.com/sao-paulo",
    cache_ttl_hours: 720,
    confidence: "medium",
    recency: "monthly",
    example_question:
      "A obra X em Vila Mariana está num bairro com ocupação Airbnb >70%?",
    cost_estimate: "free",
  },
  {
    id: "mercado_aluguel_bairro",
    name: "Preço médio de aluguel por bairro (SP)",
    category: "imobiliario",
    description:
      "Preço médio de aluguel residencial por bairro. Via Perplexity sobre QuintoAndar/Imovelweb/OLX/ZAP.",
    kind: "web_search",
    perplexity_focus: [
      "quintoandar.com.br",
      "imovelweb.com.br",
      "olx.com.br",
      "zapimoveis.com.br",
    ],
    cache_ttl_hours: 168,
    confidence: "low",
    recency: "weekly",
    example_question:
      "Em quais bairros das obras em entrega o aluguel médio cresceu mais no último ano?",
    cost_estimate: "cheap",
  },

  // ============ FORNECEDORES ============
  {
    id: "cnpj_receita",
    name: "Situação cadastral Receita Federal",
    category: "fornecedor",
    description:
      "Status do CNPJ, atividades CNAE. Útil para validar fornecedor antes de novo pedido grande.",
    kind: "api_aggregator",
    endpoint: "https://publica.cnpj.ws/cnpj/{cnpj}",
    cache_ttl_hours: 168,
    confidence: "high",
    recency: "weekly",
    example_question:
      "O fornecedor X (CNPJ Y) ainda está ativo na Receita?",
    cost_estimate: "free",
  },
  {
    id: "reclame_aqui",
    name: "Reclame Aqui — empresa",
    category: "fornecedor",
    description: "Reputação pública de fornecedor. Via Perplexity.",
    kind: "web_search",
    perplexity_focus: ["reclameaqui.com.br"],
    cache_ttl_hours: 168,
    confidence: "medium",
    recency: "weekly",
    example_question:
      "O fornecedor Z tem reclamações sérias no Reclame Aqui dos últimos 6 meses?",
    cost_estimate: "cheap",
  },
  {
    id: "tjsp_processos",
    name: "TJSP — processos contra empresa",
    category: "fornecedor",
    description:
      "Processos públicos contra um CNPJ no Tribunal de SP. Via Perplexity (consulta processual).",
    kind: "web_search",
    perplexity_focus: ["esaj.tjsp.jus.br", "jusbrasil.com.br"],
    cache_ttl_hours: 168,
    confidence: "low",
    recency: "weekly",
    example_question:
      "O fornecedor com maior volume conosco tem ações trabalhistas relevantes?",
    cost_estimate: "cheap",
  },

  // ============ REGULATÓRIO ============
  {
    id: "short_stay_lei_sp",
    name: "Regulação de short-stay em São Paulo",
    category: "regulatorio",
    description:
      "Lei 17.881/22, decretos posteriores e jurisprudência. Crítico para tese da empresa.",
    kind: "web_search",
    perplexity_focus: [
      "gov.br",
      "saopaulo.sp.gov.br",
      "jusbrasil.com.br",
      "g1.globo.com",
    ],
    cache_ttl_hours: 24,
    confidence: "medium",
    recency: "weekly",
    example_question:
      "Há nova decisão judicial nos últimos 30 dias que afete short-stay residencial em SP?",
    cost_estimate: "cheap",
  },
  {
    id: "alvara_sp",
    name: "Alvará e zoneamento — Prefeitura de SP",
    category: "regulatorio",
    description:
      "Consulta de zoneamento e alvará por endereço. Sem API — Perplexity sobre site da prefeitura.",
    kind: "web_search",
    perplexity_focus: [
      "prefeitura.sp.gov.br",
      "geosampa.prefeitura.sp.gov.br",
    ],
    cache_ttl_hours: 720,
    confidence: "low",
    recency: "monthly",
    example_question:
      "O endereço da obra X permite uso comercial/short-stay segundo zoneamento?",
    cost_estimate: "cheap",
  },

  // ============ NOTÍCIA / EVENTOS ============
  {
    id: "noticias_construcao",
    name: "Notícias de construção civil — SP",
    category: "noticia",
    description:
      "Eventos relevantes: greve, escassez de material, alta brusca de preço, mudança climática.",
    kind: "web_search",
    perplexity_focus: [
      "g1.globo.com",
      "estadao.com.br",
      "folha.uol.com.br",
      "valor.com.br",
    ],
    cache_ttl_hours: 12,
    confidence: "medium",
    recency: "daily",
    example_question:
      "Há alguma escassez de cimento ou aço prevista que afete cronogramas dos próximos 60 dias?",
    cost_estimate: "cheap",
  },
];

export function findExternalSource(id: string): ExternalSource | undefined {
  return EXTERNAL_SOURCES.find((s) => s.id === id);
}

/** Catálogo formatado para o prompt do Planner — espelho de renderCatalog(). */
export function renderExternalSourcesCatalog(): string {
  const lines: string[] = ["# CATÁLOGO DE FONTES EXTERNAS"];
  for (const s of EXTERNAL_SOURCES) {
    lines.push(
      `\n## ${s.id} — ${s.name} [${s.category}] (${s.confidence}/${s.recency})`,
    );
    lines.push(s.description);
    const tail: string[] = [`Tipo: ${s.kind}`];
    if (s.endpoint) tail.push(`endpoint: ${s.endpoint}`);
    if (s.perplexity_focus?.length)
      tail.push(`domínios: ${s.perplexity_focus.join(", ")}`);
    lines.push(tail.join(" · "));
    lines.push(`Exemplo de uso: ${s.example_question}`);
  }
  return lines.join("\n");
}
