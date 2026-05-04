import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStageChat, type StageMessage } from "@/hooks/useStageChat";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StageChatProps {
  stageId: string;
  projectId: string;
  isAdmin: boolean;
}

export function StageChat({ stageId, projectId, isAdmin }: StageChatProps) {
  const { messages, isLoading, sendMessage } = useStageChat(stageId, projectId);
  const { user } = useAuth();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    sendMessage.mutate({
      message: trimmed,
      authorName: user.user_metadata?.display_name || user.email || "Usuário",
      authorRole: isAdmin ? "admin" : "customer",
    });
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");

  return (
    <section className="space-y-3" aria-label="Chat da etapa">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
        Chat da etapa
        {messages.length > 0 && (
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] px-1.5 text-[10px]"
          >
            {messages.length}
          </Badge>
        )}
      </h3>

      {/* Messages container */}
      <div className="border rounded-lg bg-muted/20 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhuma mensagem ainda
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Inicie uma conversa sobre esta etapa do projeto.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.author_id === user?.id}
                initials={initials}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          placeholder="Escreva uma mensagem..."
          className="min-h-[44px] max-h-[100px] resize-none text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <Button
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
          aria-label="Enviar mensagem"
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </section>
  );
}

function ChatBubble({
  msg,
  isOwn,
  initials,
}: {
  msg: StageMessage;
  isOwn: boolean;
  initials: (name: string) => string;
}) {
  const isAdmin = msg.author_role === "admin";

  return (
    <div className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            "text-[10px] font-bold",
            isAdmin
              ? "bg-primary/15 text-primary"
              : "bg-accent text-accent-foreground",
          )}
        >
          {initials(msg.author_name)}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] space-y-0.5", isOwn && "items-end")}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-foreground">
            {msg.author_name}
          </span>
          {isAdmin && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] border-primary/30 text-primary"
            >
              Equipe
            </Badge>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm text-foreground",
          )}
        >
          {msg.message}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
