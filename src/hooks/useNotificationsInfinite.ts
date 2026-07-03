import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  fetchNotificationsPage,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/infra/repositories/notifications.repository";

const KEY = "notifications-infinite";
const UNREAD_COUNT_KEY = "notifications-unread-count";
const PAGE_SIZE = 20;

/**
 * Infinite-scroll variant of useNotifications. Each page is fetched via
 * keyset pagination (cursor = created_at of the last item), so new rows
 * inserted at the top via realtime never shift pagination.
 *
 * Use this in places that render a long, scrollable feed (e.g. the mobile
 * notifications bottom sheet). For badges / dropdowns showing only the
 * latest few items, prefer the simpler `useNotifications`.
 */
export function useNotificationsInfinite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  // Unique per hook instance — see useNotifications for rationale. Multiple
  // components can mount this hook concurrently (mobile bottom sheet + bell);
  // Supabase Realtime does NOT dedupe channels by topic, so a shared topic
  // triggers "cannot add postgres_changes callbacks ... after subscribe()".
  const instanceId = useId();

  const query = useInfiniteQuery({
    queryKey: [KEY, userId],
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage(userId!, {
        before: pageParam as string | undefined,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [UNREAD_COUNT_KEY, userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Flatten pages once per render
  const notifications: Notification[] = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data],
  );

  // Realtime: on insert, refetch only the first page (new items live at top).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-infinite-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Reset the infinite cache so the new row appears at the top
          // without holes/duplicates from cursor drift.
          qc.invalidateQueries({ queryKey: [KEY, userId] });
          qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc, instanceId]);

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    // Atualização otimista: aplica read_at = now() no cache imediatamente,
    // assim o badge e a ordenação refletem antes do navigate, sem flicker.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: [KEY, userId] });
      await qc.cancelQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });

      const prevPages = qc.getQueryData<{
        pages: Notification[][];
        pageParams: unknown[];
      }>([KEY, userId]);
      const prevUnread = qc.getQueryData<number>([UNREAD_COUNT_KEY, userId]);
      const nowIso = new Date().toISOString();

      let decremented = false;
      if (prevPages) {
        qc.setQueryData([KEY, userId], {
          ...prevPages,
          pages: prevPages.pages.map((page) =>
            page.map((n) => {
              if (n.id !== id) return n;
              if (!n.read_at) decremented = true;
              return { ...n, read_at: n.read_at ?? nowIso };
            }),
          ),
        });
      }
      if (decremented && typeof prevUnread === "number") {
        qc.setQueryData(
          [UNREAD_COUNT_KEY, userId],
          Math.max(0, prevUnread - 1),
        );
      }
      // Mantém o feed simples em sincronia se estiver montado.
      qc.setQueriesData<Notification[] | undefined>(
        { queryKey: ["notifications", userId] },
        (old) =>
          old?.map((n) =>
            n.id === id ? { ...n, read_at: n.read_at ?? nowIso } : n,
          ),
      );

      return { prevPages, prevUnread };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevPages) qc.setQueryData([KEY, userId], ctx.prevPages);
      if (typeof ctx?.prevUnread === "number") {
        qc.setQueryData([UNREAD_COUNT_KEY, userId], ctx.prevUnread);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY, userId] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(userId!),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: [KEY, userId] });
      await qc.cancelQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });

      const prevPages = qc.getQueryData<{
        pages: Notification[][];
        pageParams: unknown[];
      }>([KEY, userId]);
      const prevUnread = qc.getQueryData<number>([UNREAD_COUNT_KEY, userId]);
      const nowIso = new Date().toISOString();

      if (prevPages) {
        qc.setQueryData([KEY, userId], {
          ...prevPages,
          pages: prevPages.pages.map((page) =>
            page.map((n) => ({ ...n, read_at: n.read_at ?? nowIso })),
          ),
        });
      }
      qc.setQueryData([UNREAD_COUNT_KEY, userId], 0);
      qc.setQueriesData<Notification[] | undefined>(
        { queryKey: ["notifications", userId] },
        (old) =>
          old?.map((n) => ({ ...n, read_at: n.read_at ?? nowIso })),
      );

      return { prevPages, prevUnread };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevPages) qc.setQueryData([KEY, userId], ctx.prevPages);
      if (typeof ctx?.prevUnread === "number") {
        qc.setQueryData([UNREAD_COUNT_KEY, userId], ctx.prevUnread);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY, userId] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    markAsRead: useCallback(
      (id: string) => markReadMutation.mutate(id),
      [markReadMutation],
    ),
    markAllAsRead: useCallback(
      () => markAllReadMutation.mutate(),
      [markAllReadMutation],
    ),
  };
}
