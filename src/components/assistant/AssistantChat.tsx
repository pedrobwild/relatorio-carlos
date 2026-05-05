import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  Insight,
  DataQualityWarning,
  InsightVisualizationHint,
  MetricSnapshot,
} from "@/lib/assistant";
import { AssistantAnalysisPanel } from "./AssistantAnalysisPanel";

export interface AssistantMessageResultData {
  rows?: unknown[];
  rows_returned?: number;
  sql?: string;
  domain?: string;
  status?: string;
  phase?: string;
  statusMessage?: string;
  insights?: Insight[] | null;
  data_quality?: DataQualityWarning[] | null;
  visualizations?: InsightVisualizationHint[] | null;
  suggested_questions?: string[] | null;
  confidence?: number | null;
  limitations?: string[] | null;
  metrics?: MetricSnapshot[] | null;
}

export interface AssistantMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  result_data?: AssistantMessageResultData | null;
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
  "O que eu preciso priorizar hoje?",
  "Quais pagamentos estão vencidos e qual o total por obra?",
  "Quais obras estão em risco de atraso?",
  "Quais NCs críticas estão abertas?",
  "Quais compras estão atrasadas?",
];

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

  const updateLastAssistant = (
    updater: (m: AssistantMessage) => AssistantMessage,
  ) => {
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
      {
        role: "assistant",
        content: "",
        pending: true,
        result_data: { status: "streaming" },
      },
    ]);
    setInput("");
    setIsLoading(true);

    let localConvId = convId;
    let accumulated = "";
    let finalRows: unknown[] | undefined;
    let rowsReturned: number | undefined;
    let sqlText: string | undefined;
    let domainText: string | undefined;
    let finalStatus: string | undefined;
    let doneReceived = false;
    // Correlação com a edge function. Geramos do lado do cliente; o servidor
    // ecoa de volta no evento `conversation` (campo `request_id`).
    const baseRequestId =
      (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let requestId = baseRequestId;
    let serverRequestId: string | undefined;

    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    let lastError: unknown = null;

    try {
      while (attempt < MAX_ATTEMPTS) {
      attempt++;
      requestId = attempt === 1 ? baseRequestId : `${baseRequestId}-r${attempt}`;
      doneReceived = false;
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
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({
          question: trimmed,
          conversation_id: localConvId,
          stream: true,
        }),
      });

      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => "");
        throw new Error(
          `Falha (${resp.status}): ${txt.slice(0, 200) || "sem corpo"}`,
        );
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processBlock = (block: string) => {
        const lines = block.split("\n");
        let ev = "message";
        let dataStr = "";
        for (const rawLine of lines) {
          const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
          if (line.startsWith("event:")) ev = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!dataStr) return;
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          return;
        }

        switch (ev) {
          case "conversation": {
            const id = payload.conversation_id as string | undefined;
            const srvReqId = payload.request_id as string | undefined;
            if (srvReqId) serverRequestId = srvReqId;
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
            sqlText = payload.sql as string;
            domainText = payload.domain as string;
            updateLastAssistant((m) => ({
              ...m,
              result_data: {
                ...(m.result_data ?? {}),
                sql: sqlText,
                domain: domainText,
              },
            }));
            break;
          }
          case "rows": {
            rowsReturned = payload.rows_returned as number;
            finalRows = payload.preview as unknown[];
            updateLastAssistant((m) => ({
              ...m,
              result_data: {
                ...(m.result_data ?? {}),
                rows: finalRows,
                rows_returned: rowsReturned,
              },
            }));
            break;
          }
          case "analysis": {
            updateLastAssistant((m) => ({
              ...m,
              result_data: {
                ...(m.result_data ?? {}),
                insights: payload.insights as Insight[] | null,
                data_quality: payload.data_quality as
                  | DataQualityWarning[]
                  | null,
                visualizations: payload.visualizations as
                  | InsightVisualizationHint[]
                  | null,
                suggested_questions: payload.suggested_questions as
                  | string[]
                  | null,
                confidence: payload.confidence as number | null,
                limitations: payload.limitations as string[] | null,
              },
            }));
            break;
          }
          case "delta": {
            const chunk = (payload.content as string) ?? "";
            if (chunk) {
              accumulated += chunk;
              updateLastAssistant((m) => ({
                ...m,
                pending: false,
                content: accumulated,
              }));
            }
            break;
          }
          case "done": {
            doneReceived = true;
            finalStatus = payload.status as string;
            updateLastAssistant((m) => ({
              ...m,
              pending: false,
              content: (payload.answer as string) ?? accumulated,
              result_data: {
                rows: payload.rows as unknown[],
                rows_returned: payload.rows_returned as number,
                sql: payload.sql as string,
                domain: payload.domain as string,
                status: finalStatus,
                insights:
                  (payload.insights as Insight[] | null) ??
                  m.result_data?.insights ??
                  null,
                data_quality:
                  (payload.data_quality as DataQualityWarning[] | null) ??
                  m.result_data?.data_quality ??
                  null,
                visualizations:
                  (payload.visualizations as
                    | InsightVisualizationHint[]
                    | null) ??
                  m.result_data?.visualizations ??
                  null,
                suggested_questions:
                  (payload.suggested_questions as string[] | null) ??
                  m.result_data?.suggested_questions ??
                  null,
                confidence:
                  (payload.confidence as number | null) ??
                  m.result_data?.confidence ??
                  null,
                limitations:
                  (payload.limitations as string[] | null) ??
                  m.result_data?.limitations ??
                  null,
              },
            }));
            break;
          }
          case "error": {
            const msg = (payload.message as string) ?? "Erro";
            throw new Error(msg);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) processBlock(block);
      }

      // Final flush: garante que o último bloco SSE (sem \n\n final) seja processado
      buffer += decoder.decode();
      const corr = `[req=${requestId}${serverRequestId ? ` srv=${serverRequestId}` : ""}]`;
      if (buffer.trim().length > 0) {
        const looksLikeSse =
          buffer.includes("data:") || buffer.startsWith("event:");
        if (looksLikeSse) {
          // Logs em warn (regra de lint proíbe console.log).
          console.warn(
            `[AssistantChat] ${corr} SSE final flush: processando ${buffer.length}B residuais (seriam descartados sem flush)`,
          );
          for (const block of buffer.split("\n\n")) {
            if (block.trim()) processBlock(block);
          }
        } else {
          console.warn(
            `[AssistantChat] ${corr} SSE final flush: descartando ${buffer.length}B sem 'data:'/'event:' (preview=${JSON.stringify(buffer.slice(0, 80))})`,
          );
        }
        buffer = "";
      }
      } catch (innerErr) {
        lastError = innerErr;
        const isAbort =
          innerErr instanceof Error &&
          (innerErr.name === "AbortError" || /aborted/i.test(innerErr.message));
        // Não retentar em abort do usuário nem em erros explícitos do servidor (event: error)
        const serverError =
          innerErr instanceof Error && /^(Erro|Falha)/i.test(innerErr.message);
        if (isAbort || serverError) throw innerErr;
        if (attempt >= MAX_ATTEMPTS) throw innerErr;
        const delay = 400 * Math.pow(2, attempt - 1);
        console.warn(
          `[AssistantChat] [req=${requestId}] stream incompleto/erro de rede, retry ${attempt}/${MAX_ATTEMPTS - 1} em ${delay}ms:`,
          innerErr instanceof Error ? innerErr.message : innerErr,
        );
        // Reset estado parcial antes de retry para evitar duplicar conteúdo
        accumulated = "";
        updateLastAssistant((m) => ({
          ...m,
          pending: true,
          content: "",
          result_data: {
            ...(m.result_data ?? {}),
            status: "streaming",
            statusMessage: `Reconectando... (tentativa ${attempt + 1})`,
          },
        }));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Sucesso de rede: se não veio `done` e não há conteúdo, força retry
      if (!doneReceived && !accumulated) {
        if (attempt < MAX_ATTEMPTS) {
          console.warn(
            `[AssistantChat] [req=${requestId}] stream finalizou sem 'done' e sem conteúdo, retry ${attempt}/${MAX_ATTEMPTS - 1}`,
          );
          const delay = 400 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error("Resposta vazia do assistente após múltiplas tentativas");
      }
      break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      console.error(
        `[AssistantChat] [req=${requestId}${serverRequestId ? ` srv=${serverRequestId}` : ""}] erro no stream:`,
        msg,
        lastError ?? "",
      );
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
              <h3 className="font-semibold text-foreground mb-1">
                Assistente BWild
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Pergunte sobre pagamentos, compras, cronogramas, NCs, pendências
                e atendimento. Eu trago números, insights e próximos passos —
                sempre respeitando suas permissões.
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
            <MessageBubble key={i} message={m} onAsk={send} />
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

function MessageBubble({
  message,
  onAsk,
}: {
  message: AssistantMessage;
  onAsk: (q: string) => void;
}) {
  const [showSql, setShowSql] = useState(false);

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
  const rows =
    (message.result_data?.rows as Record<string, unknown>[] | undefined) ?? [];
  const hasAnalysis =
    !isError &&
    !!message.result_data &&
    ((message.result_data.insights?.length ?? 0) > 0 ||
      (message.result_data.visualizations?.length ?? 0) > 0 ||
      (message.result_data.suggested_questions?.length ?? 0) > 0 ||
      (message.result_data.data_quality?.length ?? 0) > 0);

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full">
        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span>Assistente</span>
          {message.result_data?.domain && (
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
              {message.result_data.domain}
            </Badge>
          )}
          {typeof message.result_data?.rows_returned === "number" && (
            <span>· {message.result_data.rows_returned} resultado(s)</span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm",
            isError
              ? "bg-destructive/10 border border-destructive/30"
              : "bg-muted",
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">
                {phaseMessage ?? "Consultando dados..."}
              </span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "_Sem resposta_"}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-primary/70 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          )}

          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Status: {status}</span>
            </div>
          )}
        </div>

        {hasAnalysis && (
          <div className="mt-3">
            <AssistantAnalysisPanel
              analysis={{
                insights: message.result_data?.insights ?? [],
                visualizations: message.result_data?.visualizations ?? [],
                data_quality: message.result_data?.data_quality ?? [],
                suggested_questions:
                  message.result_data?.suggested_questions ?? [],
                limitations: message.result_data?.limitations ?? [],
                confidence: message.result_data?.confidence ?? undefined,
              }}
              rows={rows}
              onAsk={onAsk}
            />
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
