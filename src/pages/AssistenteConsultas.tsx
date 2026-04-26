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
  type LucideIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface SuggestionCategory {
  label: string;
  icon: LucideIcon;
  color: string;
  questions: { label: string; question: string }[];
}

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    label: "Financeiro",
    icon: Wallet,
    color: "text-emerald-600 dark:text-emerald-400",
    questions: [
      { label: "Quais compras venceram hoje", question: "Quais compras venceram hoje? Liste obra, descrição e valor." },
      { label: "Total a pagar hoje", question: "Qual o valor total de pagamentos com vencimento hoje, agrupado por obra?" },
      { label: "Pagamentos em atraso", question: "Liste todos os pagamentos em atraso (paid_at nulo e due_date < hoje), com obra, descrição, vencimento e valor." },
      { label: "A pagar nos próximos 7 dias", question: "Quais pagamentos vencem nos próximos 7 dias? Mostre obra, vencimento, descrição e valor, ordenados por data." },
    ],
  },
  {
    label: "Compras & Fornecedores",
    icon: PackageCheck,
    color: "text-blue-600 dark:text-blue-400",
    questions: [
      { label: "Compras pendentes esta semana", question: "Quais compras (project_purchases) estão com status 'pending' e required_by_date nesta semana? Mostre item, obra e fornecedor." },
      { label: "Top fornecedores por uso", question: "Quais são os 10 fornecedores mais usados em project_purchases? Mostre nome e quantidade de compras." },
      { label: "Prestadores agendados hoje", question: "Quais prestadores (purchase_type = 'prestador') têm scheduled_start = hoje? Mostre item, obra e fornecedor." },
    ],
  },
  {
    label: "Cronograma",
    icon: CalendarClock,
    color: "text-purple-600 dark:text-purple-400",
    questions: [
      { label: "Atividades atrasadas", question: "Liste todas as atividades (project_activities) cuja planned_end < hoje e actual_end é nulo. Mostre obra, descrição, etapa e dias de atraso." },
      { label: "Atividades desta semana", question: "Quais atividades têm planned_start ou planned_end dentro da semana atual? Agrupe por obra." },
      { label: "Progresso médio por obra", question: "Mostre o progresso médio (avg de progress_pct) das atividades por obra, ordenado do menor para o maior." },
    ],
  },
  {
    label: "NCs & Pendências",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    questions: [
      { label: "NCs em aberto por obra", question: "Quantas non_conformities estão com status diferente de 'closed', agrupadas por obra?" },
      { label: "NCs vencidas", question: "Liste NCs com deadline < hoje e status diferente de 'closed'. Mostre obra, título, severidade e dias de atraso." },
      { label: "Pendências do cliente", question: "Quais pending_items estão com status 'pending' e due_date nos próximos 7 dias? Mostre obra, título e vencimento." },
    ],
  },
  {
    label: "CS — Atendimento",
    icon: ClipboardList,
    color: "text-rose-600 dark:text-rose-400",
    questions: [
      { label: "Tickets abertos por severidade", question: "Quantos cs_tickets estão abertos (resolved_at nulo) agrupados por severity?" },
      { label: "Tickets criados esta semana", question: "Liste cs_tickets criados nesta semana com obra, situação e severidade." },
    ],
  },
  {
    label: "Visão geral",
    icon: TrendingUp,
    color: "text-cyan-600 dark:text-cyan-400",
    questions: [
      { label: "Obras ativas", question: "Quantas obras (projects) estão com status 'active'? Liste nome e data de início." },
      { label: "Resumo financeiro do mês", question: "Qual o total recebido (paid_at no mês atual) e o total a receber (paid_at nulo) deste mês?" },
    ],
  },
];

interface Result {
  answer: string;
  rows: unknown[];
  rows_returned: number;
  sql?: string;
  domain?: string;
  status: string;
  conversation_id?: string;
  latency_ms?: number;
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
        body: { question: trimmed },
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
              Pergunte em linguagem natural sobre os dados do sistema. As respostas respeitam suas permissões.
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
              placeholder="Ex: Quais compras precisam ser pagas hoje e o valor total?"
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
                    Consultando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Consultar
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
          <CardContent className="pt-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Gerando consulta e analisando os dados...</span>
              </div>
            )}
            {result && !isLoading && (
              <div className="space-y-3">
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm",
                    isError
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-muted/40 border border-border"
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
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Sugestões rápidas</h2>
          <p className="text-xs text-muted-foreground">
            Clique para executar a consulta imediatamente.
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
