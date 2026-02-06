import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { debugAuth } from '@/lib/debugAuth';
import { logError, logInfo } from '@/lib/errorLogger';

export type AppRole = 'engineer' | 'admin' | 'customer' | 'manager';

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isManager: boolean;
}

// Cache role by user ID to prevent refetches on re-mounts
const roleCache = new Map<string, AppRole>();

// Track pending fetches to prevent duplicate concurrent requests
const pendingFetches = new Set<string>();

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(() => {
    // Check cache on initial mount
    if (user?.id && roleCache.has(user.id)) {
      return roleCache.get(user.id) ?? null;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  
  // Use ref to track if component is mounted
  const isMounted = useRef(true);

  const fetchRole = useCallback(async (userId: string) => {
    // Prevent duplicate fetches for the same user
    if (pendingFetches.has(userId)) {
      debugAuth('useUserRole: fetch already in progress', { userId });
      return;
    }

    // Check cache first (double-check in case it was set between renders)
    if (roleCache.has(userId)) {
      const cachedRole = roleCache.get(userId)!;
      debugAuth('useUserRole: using cached role', { userId, role: cachedRole });
      if (isMounted.current) {
        setRole(cachedRole);
        setLoading(false);
      }
      return;
    }

    pendingFetches.add(userId);
    debugAuth('useUserRole: fetching role', { userId });

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (!isMounted.current) {
        pendingFetches.delete(userId);
        return;
      }

      if (error) {
        logError('Error fetching user role', error, { 
          component: 'useUserRole', 
          userId 
        });
        setRole('customer'); // Default to customer
        roleCache.set(userId, 'customer');
      } else {
        const fetchedRole = data.role as AppRole;
        setRole(fetchedRole);
        roleCache.set(userId, fetchedRole);
        logInfo('User role fetched', { userId, role: fetchedRole });
        debugAuth('useUserRole: role fetched', { userId, role: fetchedRole });
      }
    } catch (err) {
      logError('Unexpected error in useUserRole', err, { 
        component: 'useUserRole', 
        userId 
      });
      if (isMounted.current) {
        setRole('customer');
        roleCache.set(userId, 'customer');
      }
    } finally {
      pendingFetches.delete(userId);
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    if (authLoading) return;
    
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Check cache synchronously first
    if (roleCache.has(user.id)) {
      const cachedRole = roleCache.get(user.id)!;
      setRole(cachedRole);
      setLoading(false);
      return;
    }

    // Fetch role if not cached
    fetchRole(user.id);

    return () => {
      isMounted.current = false;
    };
  }, [user?.id, authLoading, fetchRole]);

  return {
    role,
    loading: loading || authLoading,
    isStaff: role === 'engineer' || role === 'admin' || role === 'manager',
    isAdmin: role === 'admin',
    isCustomer: role === 'customer',
    isManager: role === 'manager',
  };
}

// Export function to clear cache (useful for testing or logout)
export function clearRoleCache(): void {
  roleCache.clear();
  pendingFetches.clear();
}
