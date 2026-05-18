import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  fetchNotificationsPage,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification,
} from "@/infra/repositories/notifications.repository";
import { useQuery } from "@tanstack/react-query";

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
      .channel(`notifications-infinite-${userId}`)
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
  }, [userId, qc]);

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, userId] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
      // Also keep the simple feed in sync if it's mounted elsewhere.
      qc.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(userId!),
    onSuccess: () => {
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
