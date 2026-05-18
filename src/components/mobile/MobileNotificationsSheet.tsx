import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  FileText,
  DollarSign,
  AlertCircle,
  Layers,
  ClipboardSignature,
  TrendingUp,
  Info,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNotificationsInfinite } from "@/hooks/useNotificationsInfinite";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  getUrgencyCategory,
  isBlockingNotification,
} from "@/constants/notificationUrgency";
import type { Notification } from "@/infra/repositories/notifications.repository";

const typeConfig: Record<
  string,
  { icon: typeof Bell; className: string; actionVerb: string }
> = {
  payment_due: {
    icon: DollarSign,
    className: "text-warning",
    actionVerb: "Pagar parcela",
  },
  payment_overdue: {
    icon: DollarSign,
    className: "text-destructive",
    actionVerb: "Regularizar pagamento",
  },
  formalization_pending: {
    icon: ClipboardSignature,
    className: "text-primary",
    actionVerb: "Assinar formalização",
  },
  document_uploaded: {
    icon: FileText,
    className: "text-success",
    actionVerb: "Revisar documento",
  },
  stage_changed: {
    icon: Layers,
    className: "text-primary",
    actionVerb: "Ver nova etapa",
  },
  pending_item_created: {
    icon: AlertCircle,
    className: "text-warning",
    actionVerb: "Resolver pendência",
  },
  report_published: {
    icon: TrendingUp,
    className: "text-success",
    actionVerb: "Ver relatório",
  },
  general: {
    icon: Info,
    className: "text-muted-foreground",
    actionVerb: "Ver detalhe",
  },
};

function formatTime(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Agora";
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

function NotificationRow({
  notification,
  onRead,
  onNavigate,
  isSelected,
  onSelect,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const config = typeConfig[notification.type] ?? typeConfig.general;
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const isBlocking = isBlockingNotification(notification.type);

  return (
    <button
      aria-pressed={isSelected}
      onClick={() => {
        onSelect(notification.id);
        if (isUnread) onRead(notification.id);
        if (notification.action_url) onNavigate(notification.action_url);
      }}
      className={cn(
        "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors rounded-xl min-h-[56px]",
        isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60",
        isUnread &&
          isBlocking &&
          "bg-destructive/5 border-l-2 border-destructive",
        isSelected && "ring-2 ring-primary/40 bg-primary/10",
      )}
    >
      <div className={cn("mt-0.5 shrink-0", config.className)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-tight",
            isUnread ? "font-semibold text-foreground" : "text-foreground/80",
          )}
        >
          {notification.title}
        </p>
        {isUnread && notification.action_url && isBlocking && (
          <p className="text-xs text-destructive/80 font-medium mt-0.5">
            {config.actionVerb} →
          </p>
        )}
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatTime(notification.created_at)}
        </p>
      </div>
      {isUnread && (
        <span
          className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
            isBlocking ? "bg-destructive animate-pulse" : "bg-primary",
          )}
        />
      )}
    </button>
  );
}

/**
 * Tiny IntersectionObserver-backed sentinel that fires `onIntersect`
 * once when scrolled into view. Re-arms when `hasNextPage` rerenders it.
 */
function InfiniteScrollSentinel({
  onIntersect,
  active,
}: {
  onIntersect: () => void;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onIntersect();
      },
      { root: null, rootMargin: "120px 0px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onIntersect, active]);
  return <div ref={ref} aria-hidden="true" className="h-1 w-full" />;
}

interface MobileNotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNotificationsSheet({
  open,
  onOpenChange,
}: MobileNotificationsSheetProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfinite();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drag-to-dismiss state. We translate the SheetContent imperatively
  // (via ref) during the gesture to keep it 60fps and avoid React re-renders.
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const resetTransform = useCallback((withTransition: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    el.style.transform = "";
  }, []);

  // Garante que ao fechar o sheet (por qualquer caminho: swipe, overlay,
  // ESC, botão fechar, navegação) o estado interno volte ao padrão.
  useEffect(() => {
    if (!open) {
      setActiveTab("all");
      setSelectedId(null);
      dragStartYRef.current = null;
      dragDeltaRef.current = 0;
      resetTransform(false);
    }
  }, [open, resetTransform]);

  const actionNotifications = useMemo(
    () => notifications.filter((n) => getUrgencyCategory(n.type) === "action"),
    [notifications],
  );
  const updateNotifications = useMemo(
    () => notifications.filter((n) => getUrgencyCategory(n.type) === "update"),
    [notifications],
  );
  const unreadActionCount = actionNotifications.filter(
    (n) => !n.read_at,
  ).length;

  const displayed =
    activeTab === "actions"
      ? actionNotifications
      : activeTab === "updates"
        ? updateNotifications
        : notifications;

  const handleNavigate = (url: string) => {
    // Marca a notificação como "selecionada" só visualmente durante o
    // fechamento, e dispara onOpenChange(false) — o useEffect acima limpa
    // selectedId/activeTab quando `open` vira false, garantindo retorno
    // ao estado padrão na próxima abertura.
    onOpenChange(false);
    navigate(url);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartYRef.current = e.touches[0].clientY;
    dragDeltaRef.current = 0;
    if (contentRef.current) contentRef.current.style.transition = "none";
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current == null) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    // Only react to downward drags; small rubber-band for upward attempts.
    const visualDelta = delta > 0 ? delta : delta / 4;
    dragDeltaRef.current = delta;
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${visualDelta}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (dragStartYRef.current == null) return;
    const delta = dragDeltaRef.current;
    dragStartYRef.current = null;
    dragDeltaRef.current = 0;
    // Threshold: ~25% of sheet height or absolute 120px, whichever is smaller.
    const sheetHeight = contentRef.current?.getBoundingClientRect().height ?? 0;
    const threshold = Math.min(120, sheetHeight * 0.25);
    if (delta > threshold) {
      // Animate out before closing so Radix's exit anim picks up from current pos.
      resetTransform(true);
      onOpenChange(false);
    } else {
      resetTransform(true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        className="rounded-t-3xl pb-safe max-h-[88dvh] flex flex-col p-0 will-change-transform"
        onOpenAutoFocus={(e) => {
          // Move focus to the sheet title instead of the close button so screen-
          // readers announce context first and the header gets the focus ring.
          e.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        {/* Drag zone — covers the top of the sheet (handle + header) and
            captures touch gestures to swipe-to-dismiss. */}
        <div
          className="shrink-0 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <SheetHeader className="p-0 text-left">
              <SheetTitle
                ref={titleRef}
                tabIndex={-1}
                className="text-base font-bold flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                Notificações
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="text-[10px] px-1.5 h-5"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-primary h-9 py-1 px-2 -mr-1"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 shrink-0">
            <TabsTrigger
              value="all"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[44px] text-[13px] font-medium"
            >
              Todas
            </TabsTrigger>
            <TabsTrigger
              value="actions"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[44px] text-[13px] font-medium"
            >
              <AlertCircle
                className="w-3.5 h-3.5 mr-1 text-destructive"
                aria-hidden="true"
              />
              Ação
              {unreadActionCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 h-4 min-w-[16px] px-1 text-[10px]"
                >
                  {unreadActionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="updates"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none min-h-[44px] text-[13px] font-medium"
            >
              <Calendar
                className="w-3.5 h-3.5 mr-1 text-primary"
                aria-hidden="true"
              />
              Atualizações
            </TabsTrigger>
          </TabsList>

          {["all", "actions", "updates"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0 flex-1 min-h-0">
              <ScrollArea className="h-full max-h-[60dvh]">
                {displayed.length === 0 ? (
                  <div className="py-16 text-center">
                    <Bell className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {tab === "actions"
                        ? "Nenhuma ação pendente"
                        : tab === "updates"
                          ? "Nenhuma atualização"
                          : "Nenhuma notificação"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {tab === "actions"
                        ? "Tudo certo! Nenhuma decisão bloqueando sua obra."
                        : "Notificações aparecerão aqui."}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {displayed.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        onRead={markAsRead}
                        onNavigate={handleNavigate}
                        isSelected={selectedId === n.id}
                        onSelect={setSelectedId}
                      />
                    ))}
                    {/* Infinite-scroll sentinel — only meaningful in "all" tab
                        since pagination is global; the other tabs are derived
                        filters of the same in-memory dataset. */}
                    {tab === "all" && hasNextPage && (
                      <InfiniteScrollSentinel
                        onIntersect={fetchNextPage}
                        active={open}
                      />
                    )}
                    {tab === "all" && isFetchingNextPage && (
                      <div className="py-4 flex justify-center">
                        <span
                          className="inline-block w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
                          aria-label="Carregando mais notificações"
                          role="status"
                        />
                      </div>
                    )}
                    {tab === "all" &&
                      !hasNextPage &&
                      displayed.length > 0 && (
                        <p className="py-4 text-center text-[11px] text-muted-foreground/60">
                          Você chegou ao fim.
                        </p>
                      )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
