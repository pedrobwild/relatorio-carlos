/**
 * useLinkCustomerOnLogin Hook
 * 
 * Automatically links logged-in users to their projects based on email matching.
 * This solves the case where a user is registered as a customer in project_customers
 * (by email) but their user_id hasn't been linked yet.
 */

import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logInfo, logError } from '@/lib/errorLogger';

export function useLinkCustomerOnLogin(user: User | null) {
  const hasLinkedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset link flag when user changes
    if (user?.id !== lastUserIdRef.current) {
      hasLinkedRef.current = false;
      lastUserIdRef.current = user?.id ?? null;
    }

    if (!user?.email || hasLinkedRef.current) return;

    const linkCustomerToProjects = async () => {
      try {
        // Find all project_customers entries that match this email but don't have user_id linked
        const { data: unlinkedProjects, error: fetchError } = await supabase
          .from('project_customers')
          .select('id, project_id, customer_name')
          .eq('customer_email', user.email!)
          .is('customer_user_id', null);

        if (fetchError) {
          logError('Error fetching unlinked projects', fetchError, { 
            component: 'useLinkCustomerOnLogin',
            email: user.email 
          });
          return;
        }

        if (!unlinkedProjects || unlinkedProjects.length === 0) {
          // No unlinked projects found - this is normal
          hasLinkedRef.current = true;
          return;
        }

        // Link all matching projects
        const { error: updateError } = await supabase
          .from('project_customers')
          .update({ customer_user_id: user.id })
          .eq('customer_email', user.email!)
          .is('customer_user_id', null);

        if (updateError) {
          logError('Error linking customer to projects', updateError, {
            component: 'useLinkCustomerOnLogin',
            userId: user.id,
            email: user.email,
          });
          return;
        }

        // Also ensure project_members entries exist (needed for RLS and queries)
        for (const proj of unlinkedProjects) {
          await supabase
            .from('project_members')
            .upsert(
              { project_id: proj.project_id, user_id: user.id, role: 'viewer' as any },
              { onConflict: 'project_id,user_id' }
            );
        }

        // Log success
        const projectNames = unlinkedProjects.map(p => p.customer_name || p.project_id).join(', ');
        logInfo('Customer linked to projects on login', {
          userId: user.id,
          email: user.email,
          linkedCount: unlinkedProjects.length,
          projects: projectNames,
        });

        hasLinkedRef.current = true;
      } catch (err) {
        logError('Unexpected error linking customer', err, {
          component: 'useLinkCustomerOnLogin',
          userId: user.id,
        });
      }
    };

    // Defer the database call to avoid blocking auth state updates
    setTimeout(linkCustomerToProjects, 0);
  }, [user?.id, user?.email]);
}
