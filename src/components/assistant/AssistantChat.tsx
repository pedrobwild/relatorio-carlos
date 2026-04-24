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

export interface AssistantMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  result_data?: {
    rows?: unknown[];
    rows_returned?: number;
    sql?: string;
    domain?: string;
    status?: string;
  } | null;
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
    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages.length, isLoading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !user) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { question: trimmed, conversation_id: convId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newConvId = data.conversation_id;
      if (newConvId && newConvId !== convId) {
        setConvId(newConvId);
        onConversationChange?.(newConvId);
      }

      setMessages((prev) => {
        const next = [...prev];
        // Replace last pending assistant
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].pending) {
            next[i] = {
              role: "assistant",
              content: data.answer,
              result_data: {
                rows: data.rows,
                rows_returned: data.rows_returned,
                sql: data.sql,
                domain: data.domain,
                status: data.status,
              },
            };
            break;
          }
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(msg);
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant" && next[i].pending) {
            next[i] = {
              role: "assistant",
              content: `⚠️ ${msg}`,
              result_data: { status: "other" },
            };
            break;
          }
        }
        return next;
      });
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
                Pergunte sobre pagamentos, compras, cronogramas, NCs e
                pendências. As respostas respeitam suas permissões.
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
            <MessageBubble key={i} message={m} />
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

function MessageBubble({ message }: { message: AssistantMessage }) {
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
  const isError = status && status !== "success";

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full">
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
              : "bg-muted"
          )}
        >
          {message.pending ? (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Consultando dados...</span>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || "_Sem resposta_"}
              </ReactMarkdown>
            </div>
          )}

          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Status: {status}</span>
            </div>
          )}
        </div>

        {message.result_data?.sql && (
          <button
            onClick={() => setShowSql((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
