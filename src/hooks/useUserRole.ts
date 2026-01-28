import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { debugAuth } from '@/lib/debugAuth';

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
  
  // Track last fetched user ID to prevent duplicate fetches
  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setRole(null);
      setLoading(false);
      lastFetchedUserId.current = null;
      return;
    }

    // Check cache first
    if (roleCache.has(user.id)) {
      const cachedRole = roleCache.get(user.id)!;
      debugAuth('useUserRole: using cached role', { userId: user.id, role: cachedRole });
      setRole(cachedRole);
      setLoading(false);
      lastFetchedUserId.current = user.id;
      return;
    }

    // Prevent duplicate fetch for same user
    if (lastFetchedUserId.current === user.id && role !== null) {
      debugAuth('useUserRole: already fetched for this user', { userId: user.id });
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      debugAuth('useUserRole: fetching role', { userId: user.id });
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('customer'); // Default to customer
          roleCache.set(user.id, 'customer');
        } else {
          const fetchedRole = data.role as AppRole;
          setRole(fetchedRole);
          roleCache.set(user.id, fetchedRole);
          debugAuth('useUserRole: role fetched', { userId: user.id, role: fetchedRole });
        }
      } catch (err) {
        console.error('Error:', err);
        setRole('customer');
        roleCache.set(user.id, 'customer');
      } finally {
        lastFetchedUserId.current = user.id;
        setLoading(false);
      }
    };

    fetchRole();
  }, [user?.id, authLoading]); // Only depend on user.id, not entire user object

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
}
