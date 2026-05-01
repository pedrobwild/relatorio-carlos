import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  Sparkles,
  Loader2,
  AlertCircle,
  Database,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Lightbulb,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface NumericStats {
  column: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface DataSummary {
  total_rows: number;
  numeric: NumericStats[];
  top_categories?: {
    column: string;
    values: { key: string; count: number; pct: number }[];
  };
  date_range?: { column: string; from: string; to: string };
}

export interface AssistantResultData {
  rows?: unknown[];
  rows_returned?: number;
  sql?: string;
  domain?: string;
  intent?: string;
  analysis_type?: string;
  chart_hint?: string;
  key_columns?: { label?: string; value?: string; secondary?: string } | null;
  summary?: DataSummary;
  status?: string;
  phase?: string;
  statusMessage?: string;
}

export interface AssistantMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  result_data?: AssistantResultData | null;
  pending?: boolean;
}

interface AssistantChatProps {
  conversationId?: string | null;
  onConversationChange?: (id: string) => void;
  initialMessages?: AssistantMessage[];
  suggestions?: string[];
  className?: string;
  /** Compact mode: hides suggestions bigger UI for FAB drawer */
  compact?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Quais compras precisam ser pagas hoje e o valor total?",
  "Liste as NCs em aberto agrupadas por obra",
  "Quais atividades estão atrasadas esta semana?",
  "Quanto recebemos de pagamentos este mês?",
];

// ---------------------------------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------------------------------

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const numberFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function isMonetaryColumn(name: string): boolean {
  return /(amount|cost|total|valor|preco|price|budget)/i.test(name);
}

function formatStat(value: number, column: string): string {
  if (!Number.isFinite(value)) return "—";
  if (isMonetaryColumn(column)) return currencyFmt.format(value);
  return numberFmt.format(value);
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 215 80% 55%))",
  "hsl(var(--chart-3, 142 70% 45%))",
  "hsl(var(--chart-4, 32 95% 55%))",
  "hsl(var(--chart-5, 0 75% 60%))",
  "hsl(var(--chart-6, 280 70% 60%))",
];

// Extrai a seção "Perguntas relacionadas" do markdown e devolve as sugestões.
function extractFollowUps(markdown: string): { content: string; followUps: string[] } {
  const headingRegex =
    /\n+\s*(?:\*\*|##\s*)?Perguntas relacionadas[:\s]*(?:\*\*)?\s*\n+([\s\S]*)$/i;
  const match = markdown.match(headingRegex);
  if (!match) return { content: markdown, followUps: [] };
  const tail = match[1] ?? "";
  const followUps = tail
    .split("\n")
    .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
    .filter((l) => l.length > 0 && !/^perguntas/i.test(l))
    .slice(0, 5);
  const content = markdown.slice(0, match.index ?? 0).trimEnd();
  return { content, followUps };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssistantChat({
  conversationId: externalConvId,
  onConversationChange,
  initialMessages = [],
  suggestions = DEFAULT_SUGGESTIONS,
  className,
  compact = false,
}: AssistantChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(externalConvId ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConvId(externalConvId ?? null);
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalConvId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages.length, isLoading]);

  const updateLastAssistant = (updater: (m: AssistantMessage) => AssistantMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = updater(next[i]);
          break;
        }
      }
      return next;
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !user) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", pending: true, result_data: { status: "streaming" } },
    ]);
    setInput("");
    setIsLoading(true);

    let localConvId = convId;
    let accumulated = "";

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          question: trimmed,
          conversation_id: localConvId,
          stream: true,
        }),
      });

      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Falha (${resp.status}): ${txt.slice(0, 200) || "sem corpo"}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split("\n");
          let ev = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataStr);
          } catch {
            continue;
          }

          switch (ev) {
            case "conversation": {
              const id = payload.conversation_id as string | undefined;
              if (id && id !== localConvId) {
                localConvId = id;
                setConvId(id);
                onConversationChange?.(id);
              }
              break;
            }
            case "status": {
              const message = (payload.message as string) ?? "Processando...";
              updateLastAssistant((m) => ({
                ...m,
                pending: !accumulated,
                content: accumulated,
                result_data: {
                  ...(m.result_data ?? {}),
                  status: "streaming",
                  phase: payload.phase as string,
                  statusMessage: message,
                },
              }));
              break;
            }
            case "sql": {
              updateLastAssistant((m) => ({
                ...m,
                result_data: {
                  ...(m.result_data ?? {}),
                  sql: payload.sql as string,
                  domain: payload.domain as string,
                  intent: payload.intent as string,
                  analysis_type: payload.analysis_type as string,
                  chart_hint: payload.chart_hint as string,
                  key_columns: payload.key_columns as AssistantResultData["key_columns"],
                },
              }));
              break;
            }
            case "rows": {
              updateLastAssistant((m) => ({
                ...m,
                result_data: {
                  ...(m.result_data ?? {}),
                  rows: payload.preview as unknown[],
                  rows_returned: payload.rows_returned as number,
                  summary: payload.summary as DataSummary,
                },
              }));
              break;
            }
            case "delta": {
              const chunk = (payload.content as string) ?? "";
              if (chunk) {
                accumulated += chunk;
                updateLastAssistant((m) => ({ ...m, pending: false, content: accumulated }));
              }
              break;
            }
            case "done": {
              const finalStatus = payload.status as string;
              updateLastAssistant((m) => ({
                ...m,
                pending: false,
                content: (payload.answer as string) ?? accumulated,
                result_data: {
                  rows: payload.rows as unknown[],
                  rows_returned: payload.rows_returned as number,
                  sql: payload.sql as string,
                  domain: payload.domain as string,
                  intent: payload.intent as string,
                  analysis_type: payload.analysis_type as string,
                  chart_hint: payload.chart_hint as string,
                  key_columns: payload.key_columns as AssistantResultData["key_columns"],
                  summary: payload.summary as DataSummary,
                  status: finalStatus,
                },
              }));
              break;
            }
            case "error": {
              const msg = (payload.message as string) ?? "Erro";
              throw new Error(msg);
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(msg);
      updateLastAssistant((m) => ({
        ...m,
        pending: false,
        content: accumulated || `⚠️ ${msg}`,
        result_data: { ...(m.result_data ?? {}), status: "other" },
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const showSuggestions = !compact && messages.length === 0;

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef as never}>
        <div className="px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Assistente BWild</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Pergunte sobre pagamentos, compras, cronogramas, NCs, vistorias e
                pendências. As respostas são analíticas, com KPIs, gráficos e
                sugestões — e respeitam suas permissões.
              </p>
            </div>
          )}

          {showSuggestions && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Sugestões
              </p>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={isLoading}
                    className="text-left text-sm px-3 py-2 rounded-md border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} onAskFollowUp={send} disabled={isLoading} />
          ))}
        </div>
      </ScrollArea>

      <Separator />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 flex items-center gap-2 shrink-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre o sistema..."
          disabled={isLoading}
          autoFocus
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bolha de mensagem (usuário ou assistente)
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  onAskFollowUp,
  disabled,
}: {
  message: AssistantMessage;
  onAskFollowUp: (q: string) => void;
  disabled: boolean;
}) {
  const [showSql, setShowSql] = useState(false);

  const { content: cleanedContent, followUps } = useMemo(() => {
    if (message.role !== "assistant" || !message.content) {
      return { content: message.content, followUps: [] as string[] };
    }
    return extractFollowUps(message.content);
  }, [message.content, message.role]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const status = message.result_data?.status;
  const isStreaming = status === "streaming";
  const isError = status && status !== "success" && status !== "streaming";
  const phaseMessage = message.result_data?.statusMessage;
  const summary = message.result_data?.summary;
  const rows = message.result_data?.rows;
  const chartHint = message.result_data?.chart_hint;
  const keyColumns = message.result_data?.key_columns ?? null;
  const analysisType = message.result_data?.analysis_type;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full">
        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground flex-wrap">
          <Sparkles className="h-3 w-3" />
          <span>Assistente</span>
          {message.result_data?.domain && (
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
              {message.result_data.domain}
            </Badge>
          )}
          {analysisType && (
            <Badge variant="outline" className="h-5 text-[10px] px-1.5">
              {analysisType}
            </Badge>
          )}
          {typeof message.result_data?.rows_returned === "number" && (
            <span>· {message.result_data.rows_returned} resultado(s)</span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm space-y-3",
            isError ? "bg-destructive/10 border border-destructive/30" : "bg-muted",
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">{phaseMessage ?? "Consultando dados..."}</span>
            </div>
          ) : (
            <>
              {summary && summary.numeric.length > 0 && (
                <KPICards summary={summary} />
              )}

              <div className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {cleanedContent || "_Sem resposta_"}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-primary/70 animate-pulse rounded-sm align-middle" />
                )}
              </div>

              {!isStreaming && rows && rows.length > 1 && chartHint && chartHint !== "none" && (
                <ChartView
                  rows={rows as Record<string, unknown>[]}
                  chartHint={chartHint}
                  keyColumns={keyColumns}
                />
              )}
            </>
          )}

          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Status: {status}</span>
            </div>
          )}
        </div>

        {!isStreaming && followUps.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3" />
              <span className="font-medium">Perguntas relacionadas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {followUps.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAskFollowUp(q)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent hover:border-primary/40 transition-colors disabled:opacity-50 text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {message.result_data?.sql && (
          <button
            onClick={() => setShowSql((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSql ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Database className="h-3 w-3" />
            Ver consulta SQL
          </button>
        )}
        {showSql && message.result_data?.sql && (
          <pre className="mt-1.5 text-[11px] bg-muted/50 border border-border rounded-md p-2 overflow-x-auto">
            <code>{message.result_data.sql}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPICards: cards de estatística numérica acima da resposta
// ---------------------------------------------------------------------------

function KPICards({ summary }: { summary: DataSummary }) {
  // Mostrar até 4 KPIs: priorizar colunas monetárias, depois quantidades.
  const ranked = [...summary.numeric].sort((a, b) => {
    const am = isMonetaryColumn(a.column) ? 1 : 0;
    const bm = isMonetaryColumn(b.column) ? 1 : 0;
    return bm - am;
  });
  const top = ranked.slice(0, 4);
  if (top.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {top.map((s) => {
        const showSum =
          isMonetaryColumn(s.column) || s.column.toLowerCase().includes("count") || s.count > 1;
        const value = showSum ? s.sum : s.avg;
        const label = showSum ? "Soma" : "Média";
        return (
          <div
            key={s.column}
            className="rounded-md border border-border bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span className="truncate">{s.column}</span>
            </div>
            <div className="font-semibold text-sm mt-0.5 truncate">
              {formatStat(value, s.column)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {label} · {s.count} val.
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartView: bar/line/pie a partir das linhas + key_columns
// ---------------------------------------------------------------------------

function ChartView({
  rows,
  chartHint,
  keyColumns,
}: {
  rows: Record<string, unknown>[];
  chartHint: string;
  keyColumns: { label?: string; value?: string; secondary?: string } | null;
}) {
  const sample = rows[0] ?? {};
  const cols = Object.keys(sample);

  // Se o LLM não passou key_columns, inferimos: 1ª string como label, 1ª numérica como value.
  let labelKey = keyColumns?.label;
  let valueKey = keyColumns?.value;
  if (!labelKey || !cols.includes(labelKey)) {
    labelKey = cols.find((c) => typeof sample[c] === "string");
  }
  if (!valueKey || !cols.includes(valueKey)) {
    valueKey = cols.find(
      (c) => c !== labelKey && typeof sample[c] === "number" && !/_id$|^id$/.test(c),
    );
  }

  if (!labelKey || !valueKey) return null;

  const data = rows
    .slice(0, 12)
    .map((r) => ({
      label: String(r[labelKey as string] ?? ""),
      value: Number(r[valueKey as string] ?? 0),
    }))
    .filter((d) => Number.isFinite(d.value));

  if (data.length === 0) return null;

  const Icon =
    chartHint === "line" ? LineIcon : chartHint === "pie" ? PieIcon : BarChart3;

  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        <span>{valueKey} por {labelKey}</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {chartHint === "line" ? (
            <LineChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          ) : chartHint === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" outerRadius={70} label>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
