import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead } from "@/infra/repositories/notifications.repository";

const NOTIFICATIONS_KEY = "notifications";
const UNREAD_COUNT_KEY = "notifications-unread-count";

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  // Unique per hook instance — multiple components (NotificationBell,
  // MobileBottomNav, MobileProfileSheet) mount useNotifications concurrently.
  // Supabase Realtime does NOT dedupe channels by topic: reusing the same
  // topic string across instances (or across StrictMode's double-mount) leads
  // to `.on()` being called on an already-subscribed channel, which throws
  // "cannot add postgres_changes callbacks ... after subscribe()" — the exact
  // error that was crashing the ErrorBoundary in production.
  const instanceId = useId();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: [NOTIFICATIONS_KEY, userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [UNREAD_COUNT_KEY, userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, userId] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, userId] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllAsRead(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, userId] });
      qc.invalidateQueries({ queryKey: [UNREAD_COUNT_KEY, userId] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
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
