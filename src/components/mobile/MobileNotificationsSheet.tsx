import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  isNavigating,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (url: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isNavigating: boolean;
}) {
  const config = typeConfig[notification.type] ?? typeConfig.general;
  const Icon = config.icon;
  const isUnread = !notification.read_at;
  const isBlocking = isBlockingNotification(notification.type);
  const showSpinner = isSelected && isNavigating;

  return (
    <button
      aria-pressed={isSelected}
      aria-busy={showSpinner}
      disabled={showSpinner}
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
        showSpinner && "opacity-80 cursor-progress",
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
      {showSpinner ? (
        <span
          role="status"
          aria-label="Abrindo"
          className="w-3.5 h-3.5 rounded-full shrink-0 mt-1 border-2 border-primary/30 border-t-primary animate-spin"
        />
      ) : (
        isUnread && (
          <span
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
              isBlocking ? "bg-destructive animate-pulse" : "bg-primary",
            )}
          />
        )
      )}
    </button>
  );
}

/** Linha "fantasma" usada enquanto o cache inicial carrega. */
function NotificationRowSkeleton() {
  return (
    <div className="w-full px-4 py-3.5 flex items-start gap-3 min-h-[56px] rounded-xl">
      <Skeleton className="w-5 h-5 rounded-md shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}



/**
 * Virtualized notification list. Uses `@tanstack/react-virtual` over a
 * native scroll container (the only one that exposes a stable
 * `clientHeight` to the virtualizer), so the list stays smooth com
 * centenas de itens. Linhas têm altura variável e são medidas via
 * `measureElement`. Infinite-scroll dispara quando a última linha
 * virtual se aproxima do fim do dataset.
 *
 * O container carrega `data-notif-scroll` para os efeitos de reset de
 * scroll do parent (na abertura e na troca de aba) alcançarem-no da
 * mesma forma que alcançam o viewport do Radix ScrollArea.
 */
function VirtualNotificationList({
  items,
  markAsRead,
  onNavigate,
  selectedId,
  onSelect,
  isNavigating,
  showLoadMore,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  items: Notification[];
  markAsRead: (id: string) => void;
  onNavigate: (url: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isNavigating: boolean;
  showLoadMore: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 8,
    getItemKey: (i) => items[i]?.id ?? i,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  useEffect(() => {
    if (!showLoadMore || !hasNextPage || isFetchingNextPage) return;
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= items.length - 3) fetchNextPage();
  }, [
    virtualItems,
    items.length,
    showLoadMore,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  return (
    <div
      ref={parentRef}
      data-notif-scroll
      className="h-full max-h-[60dvh] overflow-y-auto overscroll-contain"
    >
      <div
        style={{ height: `${totalSize}px`, position: "relative", width: "100%" }}
        className="p-2"
      >
        {virtualItems.map((vi) => {
          const n = items[vi.index];
          if (!n) return null;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
              className="px-0 py-0.5"
            >
              <NotificationRow
                notification={n}
                onRead={markAsRead}
                onNavigate={onNavigate}
                isSelected={selectedId === n.id}
                onSelect={onSelect}
                isNavigating={isNavigating}
              />
            </div>
          );
        })}
      </div>
      {showLoadMore && isFetchingNextPage && (
        <div className="py-4 flex justify-center">
          <span
            className="inline-block w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"
            aria-label="Carregando mais notificações"
            role="status"
          />
        </div>
      )}
      {showLoadMore && !hasNextPage && items.length > 0 && (
        <p className="py-4 text-center text-[11px] text-muted-foreground/60">
          Você chegou ao fim.
        </p>
      )}
    </div>
  );
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
    isLoading,
    markAsRead,
    markAllAsRead,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsInfinite();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Drag-to-dismiss state. We translate the SheetContent imperatively
  // (via ref) during the gesture to keep it 60fps and avoid React re-renders.
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Marcador de transição de abertura. Enquanto `true`, qualquer reset
  // de scroll programático é permitido (estamos animando o sheet para
  // dentro); assim que o usuário rolar manualmente OU a animação
  // terminar, paramos de sobrescrever o scroll para não “puxar” o
  // conteúdo de volta no meio de uma interação.
  const isOpeningRef = useRef(false);
  const userScrolledRef = useRef(false);

  const resetTransform = useCallback((withTransition: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    el.style.transform = "";
  }, []);

  /** Zera o scroll de todos os containers roláveis internos. */
  const resetScrollContainers = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>(
        "[data-radix-scroll-area-viewport],[data-notif-scroll]",
      )
      .forEach((vp) => {
        if (vp.scrollTop !== 0) vp.scrollTop = 0;
      });
  }, []);

  // Garante que ao fechar o sheet (por qualquer caminho: swipe, overlay,
  // ESC, botão fechar, navegação) o estado interno volte ao padrão.
  // Ao reabrir, reposiciona o scroll de todas as ScrollAreas internas para
  // o topo — sem sobrescrever scroll do usuário no meio da animação de
  // abertura nem após ele rolar manualmente.
  useEffect(() => {
    if (!open) {
      setActiveTab("all");
      setSelectedId(null);
      setIsNavigating(false);
      dragStartYRef.current = null;
      dragDeltaRef.current = 0;
      isOpeningRef.current = false;
      userScrolledRef.current = false;
      resetTransform(false);
      return;
    }

    // Inicia janela de transição: enquanto durar, reaplica scrollTop=0
    // a cada frame para cobrir conteúdo que monta tardiamente (ex.:
    // virtualizer que só calcula size após primeira medição). Para
    // assim que (a) o usuário rolar, (b) a animação terminar, ou
    // (c) o timeout máximo expirar — o que vier primeiro.
    isOpeningRef.current = true;
    userScrolledRef.current = false;

    let rafId = 0;
    const tick = () => {
      if (!isOpeningRef.current || userScrolledRef.current) return;
      resetScrollContainers();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // Fallback caso animationend não dispare (jsdom, prefers-reduced-motion,
    // ou animação ausente): encerra a janela após 400ms.
    const timeoutId = window.setTimeout(() => {
      isOpeningRef.current = false;
    }, 400);

    const onAnimEnd = (e: AnimationEvent) => {
      // Só interessa a animação do próprio SheetContent, não de filhos.
      if (e.target !== contentRef.current) return;
      isOpeningRef.current = false;
    };
    const node = contentRef.current;
    node?.addEventListener("animationend", onAnimEnd);

    // Detecta interação manual do usuário em qualquer container rolável.
    const onUserScroll = () => {
      userScrolledRef.current = true;
    };
    const scrollers = node?.querySelectorAll<HTMLElement>(
      "[data-radix-scroll-area-viewport],[data-notif-scroll]",
    );
    scrollers?.forEach((s) => {
      s.addEventListener("wheel", onUserScroll, { passive: true });
      s.addEventListener("touchmove", onUserScroll, { passive: true });
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      node?.removeEventListener("animationend", onAnimEnd);
      scrollers?.forEach((s) => {
        s.removeEventListener("wheel", onUserScroll);
        s.removeEventListener("touchmove", onUserScroll);
      });
      isOpeningRef.current = false;
    };
  }, [open, resetTransform, resetScrollContainers]);

  // Ao alternar entre abas (Todas / Ação / Atualizações), reposiciona o
  // scroll para o topo — evita que o usuário comece a leitura no meio da
  // lista herdando a posição da aba anterior. Skipped durante a abertura,
  // pois o loop de transição já garante topo=0.
  useEffect(() => {
    if (!open || isOpeningRef.current) return;
    // Troca de aba é interação intencional do usuário, então sempre
    // forçamos topo e zeramos o marcador para que continue valendo.
    userScrolledRef.current = false;
    const raf = requestAnimationFrame(resetScrollContainers);
    return () => cancelAnimationFrame(raf);
  }, [activeTab, open, resetScrollContainers]);

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
    // Feedback imediato: ativa estado de "navegando" para mostrar spinner
    // na linha tocada enquanto fecha o sheet e roteia. O useEffect de
    // `open` limpa tudo na próxima abertura.
    setIsNavigating(true);
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
              {isLoading && displayed.length === 0 ? (
                <div
                  className="p-2 space-y-0.5 h-full max-h-[60dvh] overflow-hidden"
                  role="status"
                  aria-busy="true"
                  aria-label="Carregando notificações"
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <NotificationRowSkeleton key={i} />
                  ))}
                </div>
              ) : displayed.length === 0 ? (
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
                <VirtualNotificationList
                  items={displayed}
                  markAsRead={markAsRead}
                  onNavigate={handleNavigate}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  isNavigating={isNavigating}
                  showLoadMore={tab === "all"}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
