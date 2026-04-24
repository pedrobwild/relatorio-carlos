import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AssistantChat } from "./AssistantChat";
import { useAuth } from "@/hooks/useAuth";

/**
 * Floating button (FAB) available across all /gestao routes.
 * Opens a side drawer with the AI chat. Persists conversation per session.
 */
export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { user } = useAuth();
  const location = useLocation();

  // Hide on auth screen
  if (!user || location.pathname === "/auth") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          aria-label="Abrir assistente de IA"
          size="lg"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg shadow-primary/30 z-40 p-0"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente BWild
          </SheetTitle>
          <SheetDescription className="text-xs">
            Pergunte sobre pagamentos, compras, NCs e mais. Respostas baseadas
            nos dados que você tem permissão para ver.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <AssistantChat
            conversationId={conversationId}
            onConversationChange={setConversationId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
