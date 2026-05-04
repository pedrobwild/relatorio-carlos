import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AssistantChat,
  type AssistantMessage,
} from "@/components/assistant/AssistantChat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MessageSquare,
  FileBarChart,
  Loader2,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUserRole } from "@/hooks/useUserRole";

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
}

export default function Assistente() {
  const { user } = useAuth();
  const { isStaff } = useUserRole();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    document.title = "Assistente IA · BWild";
  }, []);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingConvs(true);
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, title, last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar conversas");
    setConversations((data ?? []) as Conversation[]);
    setLoadingConvs(false);
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true);
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("id, role, content, result_data")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar mensagens");
      setMessages([]);
    } else {
      setMessages(
        (data ?? []).map(
          (m: {
            id: string;
            role: string;
            content: string;
            result_data: unknown;
          }) => ({
            id: m.id,
            role: (m.role === "assistant" ? "assistant" : "user") as
              | "user"
              | "assistant",
            content: m.content,
            result_data: m.result_data as AssistantMessage["result_data"],
          }),
        ),
      );
    }
    setLoadingMsgs(false);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
    loadMessages(id);
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from("assistant_conversations")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir conversa");
      return;
    }
    toast.success("Conversa excluída");
    if (activeId === id) newConversation();
    loadConversations();
  };

  const handleConversationChange = (id: string) => {
    setActiveId(id);
    loadConversations();
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
      {/* Sidebar de conversas */}
      <aside className="hidden md:flex w-72 border-r border-border bg-card/40 flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <Button
            onClick={newConversation}
            className="w-full justify-start gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </Button>
          {isStaff && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <Link to="/gestao/assistente/logs">
                <FileBarChart className="h-4 w-4" />
                Relatório de logs
              </Link>
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConvs && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!loadingConvs && conversations.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">
                Nenhuma conversa ainda. Faça sua primeira pergunta!
              </p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md transition-colors",
                  activeId === c.id ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <button
                  onClick={() => selectConversation(c.id)}
                  className="flex-1 text-left px-3 py-2 text-sm truncate flex items-center gap-2"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label="Excluir conversa"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. As mensagens serão
                        removidas, mas os logs técnicos permanecem.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteConversation(c.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat principal */}
      <main className="flex-1 min-w-0 flex flex-col">
        {loadingMsgs ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AssistantChat
            key={activeId ?? "new"}
            conversationId={activeId}
            onConversationChange={handleConversationChange}
            initialMessages={messages}
          />
        )}
      </main>
    </div>
  );
}
