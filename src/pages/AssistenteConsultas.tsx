import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Database,
  ChevronRight,
  ChevronDown,
  Wallet,
  AlertTriangle,
  CalendarClock,
  PackageCheck,
  TrendingUp,
  ClipboardList,
  Compass,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import type {
  Insight,
  DataQualityWarning,
  InsightVisualizationHint,
} from "@/lib/assistant";
import { AssistantAnalysisPanel } from "@/components/assistant/AssistantAnalysisPanel";
import { ConfidenceBadge } from "@/components/assistant/ConfidenceBadge";

interface SuggestionCategory {
  label: string;
  icon: LucideIcon;
  color: string;
  questions: { label: string; question: string }[];
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    label: "Executivo",
    icon: Compass,
    color: "text-cyan-600 dark:text-cyan-400",
    questions: [
      { label: "O que priorizar hoje", question: "O que eu preciso priorizar hoje no portal?" },
      { label: "Maiores riscos agora", question: "Quais são os maiores riscos da operação agora? Resumo executivo." },
      { label: "5 ações de impacto", question: "Quais 5 ações geram mais impacto esta semana?" },
      { label: "Qualidade dos dados", question: "Quais dados parecem ruins, incompletos ou inconsistentes?" },
    ],
  },
  {
    label: "Financeiro",
    icon: Wallet,
    color: "text-emerald-600 dark:text-emerald-400",
    questions: [
      { label: "Vencidos por obra", question: "Quais pagamentos estão vencidos e qual o total por obra?" },
      { label: "A pagar hoje", question: "Qual o valor total de pagamentos com vencimento hoje, agrupado por obra?" },
      { label: "Próximos 7 dias", question: "Quais pagamentos vencem nos próximos 7 dias? Mostre obra, vencimento, descrição e valor, ordenados por data." },
      { label: "Recebido este mês", question: "Quanto foi recebido em pagamentos neste mês, total e por obra?" },
      { label: "Concentração em aberto", question: "Quais obras concentram maior valor em aberto?" },
    ],
  },
  {
    label: "Compras & Fornecedores",
    icon: PackageCheck,
    color: "text-blue-600 dark:text-blue-400",
    questions: [
      { label: "Compras atrasadas", question: "Quais compras estão atrasadas? Mostre obra, item, fornecedor e dias de atraso." },
      { label: "Top fornecedores por uso", question: "Quais são os 10 fornecedores mais usados em project_purchases? Mostre nome e quantidade de compras." },
      { label: "Itens sem fornecedor", question: "Quais compras estão sem fornecedor associado?" },
      { label: "Custo real vs estimado", question: "Onde o custo real ultrapassou o estimado? Top 10 com maior excesso." },
      { label: "Críticas da semana", question: "Quais compras são críticas para esta semana?" },
    ],
  },
  {
    label: "Cronograma",
    icon: CalendarClock,
    color: "text-purple-600 dark:text-purple-400",
    questions: [
      { label: "Atividades atrasadas", question: "Liste todas as atividades atrasadas (planned_end < hoje e actual_end IS NULL). Mostre obra, descrição, etapa e dias de atraso." },
      { label: "Atividades da semana", question: "Quais atividades têm planned_start ou planned_end dentro da semana atual? Agrupe por obra." },
      { label: "Etapas com mais atraso", question: "Quais etapas concentram mais atrasos? Conte atividades atrasadas por etapa." },
      { label: "Sem responsável", question: "Quais atividades não têm responsável definido?" },
    ],
  },
  {
    label: "NCs & Pendências",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    questions: [
      { label: "NCs em aberto por obra", question: "Quantas non_conformities estão com status diferente de 'closed', agrupadas por obra?" },
      { label: "NCs críticas abertas", question: "Quais NCs com severidade crítica estão em aberto? Mostre obra, título, deadline e responsável." },
      { label: "NCs vencidas", question: "Liste NCs com deadline < hoje e status diferente de 'closed'. Mostre obra, título, severidade e dias de atraso." },
      { label: "Pendências do cliente", question: "Quais pending_items estão com status 'pending' e due_date nos próximos 7 dias? Mostre obra, título e vencimento." },
      { label: "Pendências bloqueadoras", question: "Quais pendências bloqueando obras estão atrasadas?" },
    ],
  },
  {
    label: "CS — Atendimento",
    icon: ClipboardList,
    color: "text-rose-600 dark:text-rose-400",
    questions: [
      { label: "Tickets críticos abertos", question: "Quais cs_tickets críticos (severity = 'critical') estão sem resolved_at? Mostre obra e situação." },
      { label: "Tickets sem responsável", question: "Quais tickets de atendimento estão sem responsible_user_id?" },
      { label: "Por obra", question: "Quais obras têm mais tickets de CS abertos?" },
    ],
  },
  {
    label: "Visão geral",
    icon: TrendingUp,
    color: "text-cyan-600 dark:text-cyan-400",
    questions: [
      { label: "Obras ativas", question: "Quantas obras (projects) estão com status 'active' e não foram arquivadas? Liste nome e data de início." },
      { label: "Resumo financeiro do mês", question: "Qual o total recebido (paid_at no mês atual) e o total a receber (paid_at nulo) deste mês?" },
    ],
  },
];

interface Result {
  answer: string;
  rows: Record<string, unknown>[];
  rows_returned: number;
  sql?: string;
  domain?: string;
  status: string;
  conversation_id?: string;
  latency_ms?: number;
  insights?: Insight[] | null;
  data_quality?: DataQualityWarning[] | null;
  visualizations?: InsightVisualizationHint[] | null;
  suggested_questions?: string[] | null;
  confidence?: number | null;
  limitations?: string[] | null;
}

export default function AssistenteConsultas() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    document.title = "Consultas do Assistente · BWild";
  }, []);

  const runQuery = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isLoading || !user) return;

    setIsLoading(true);
    setResult(null);
    setLastQuestion(trimmed);
    setShowSql(false);

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { question: trimmed, stream: false },
      });
      if (error) throw error;
      if (data?.error && !data?.answer) throw new Error(data.error);
      setResult(data as Result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(msg);
      setResult({
        answer: `⚠️ ${msg}`,
        rows: [],
        rows_returned: 0,
        status: "other",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isError = result && result.status !== "success";

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Consultas do Assistente</h1>
            <p className="text-sm text-muted-foreground">
              Pergunte em linguagem natural — receba números, insights e próximos passos. As respostas respeitam suas permissões.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/gestao/assistente">Ir ao chat completo</Link>
          </Button>
        </div>
      </header>

      {/* Input */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runQuery(question);
            }}
            className="space-y-3"
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: O que eu preciso priorizar hoje?"
              rows={3}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runQuery(question);
                }
              }}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Dica: <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px]">Ctrl/⌘ + Enter</kbd> para enviar
              </p>
              <Button type="submit" disabled={isLoading || !question.trim()} className="gap-2">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Analisar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      {(result || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Resposta para:
                </CardTitle>
                <p className="text-sm font-semibold mt-1 break-words">{lastQuestion}</p>
              </div>
              {result && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {result.domain && (
                    <Badge variant="secondary" className="text-[10px]">{result.domain}</Badge>
                  )}
                  <Badge
                    variant={isError ? "destructive" : "outline"}
                    className="text-[10px]"
                  >
                    {result.rows_returned} resultado(s)
                  </Badge>
                  {typeof result.confidence === "number" && <ConfidenceBadge confidence={result.confidence} />}
                  {typeof result.latency_ms === "number" && (
                    <Badge variant="outline" className="text-[10px]">
                      {result.latency_ms} ms
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Gerando consulta, executando análise e produzindo insights...</span>
              </div>
            )}
            {result && !isLoading && (
              <>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm",
                    isError
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-muted/40 border border-border",
                  )}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.answer || "_Sem resposta_"}
                    </ReactMarkdown>
                  </div>
                  {isError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>Status: {result.status}</span>
                    </div>
                  )}
                </div>

                {!isError && (
                  <AssistantAnalysisPanel
                    analysis={{
                      insights: result.insights ?? [],
                      visualizations: result.visualizations ?? [],
                      data_quality: result.data_quality ?? [],
                      suggested_questions: result.suggested_questions ?? [],
                      limitations: result.limitations ?? [],
                      confidence: result.confidence ?? undefined,
                    }}
                    rows={result.rows ?? []}
                    onAsk={(q) => {
                      setQuestion(q);
                      runQuery(q);
                    }}
                  />
                )}

                {result.sql && (
                  <div>
                    <button
                      onClick={() => setShowSql((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSql ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <Database className="h-3 w-3" />
                      Ver consulta SQL gerada
                    </button>
                    {showSql && (
                      <pre className="mt-2 text-[11px] bg-muted/50 border border-border rounded-md p-2 overflow-x-auto">
                        <code>{result.sql}</code>
                      </pre>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Sugestões rápidas</h2>
          <p className="text-xs text-muted-foreground">
            Clique para executar a análise imediatamente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUGGESTION_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.label}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", cat.color)} />
                    {cat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {cat.questions.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => {
                        setQuestion(q.question);
                        runQuery(q.question);
                      }}
                      disabled={isLoading}
                      className="w-full text-left text-sm px-3 py-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {q.label}
                    </button>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
