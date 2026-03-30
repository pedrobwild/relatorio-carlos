import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, record, old_record } = payload;

    if (!record?.id) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notifications: Array<{
      user_id: string;
      type: string;
      title: string;
      body: string;
      project_id: string | null;
      action_url: string;
    }> = [];

    const actionUrl = `/obra/${record.project_id}?tab=ncs`;

    // INSERT — New NC created
    if (type === 'INSERT') {
      if (record.responsible_user_id) {
        notifications.push({
          user_id: record.responsible_user_id,
          type: 'nc_assigned',
          title: 'Nova NC atribuída a você',
          body: `Você foi designado como responsável pela NC: ${record.title}`,
          project_id: record.project_id,
          action_url: actionUrl,
        });
      }
    }

    // UPDATE — Status changed
    if (type === 'UPDATE' && old_record?.status !== record.status) {
      // Notify creator (if not the responsible)
      if (record.created_by && record.created_by !== record.responsible_user_id) {
        notifications.push({
          user_id: record.created_by,
          type: 'nc_status_changed',
          title: 'Status de NC atualizado',
          body: `NC "${record.title}" mudou para: ${record.status}`,
          project_id: record.project_id,
          action_url: actionUrl,
        });
      }

      // Notify responsible (if exists and different from creator)
      if (record.responsible_user_id && record.responsible_user_id !== record.created_by) {
        notifications.push({
          user_id: record.responsible_user_id,
          type: 'nc_status_changed',
          title: 'Status de NC atualizado',
          body: `NC "${record.title}" mudou para: ${record.status}`,
          project_id: record.project_id,
          action_url: actionUrl,
        });
      }

      // pending_approval → notify admin/manager members of the project
      if (record.status === 'pending_approval' && record.project_id) {
        // Get project members who are admin or manager
        const { data: members } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', record.project_id);

        if (members && members.length > 0) {
          const memberIds = members.map((m: { user_id: string }) => m.user_id);

          // Filter to only admin/manager roles
          const { data: approvers } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('user_id', memberIds)
            .in('role', ['admin', 'manager']);

          for (const approver of approvers || []) {
            // Avoid duplicate notifications
            const alreadyNotified = notifications.some(n => n.user_id === approver.user_id);
            if (!alreadyNotified) {
              notifications.push({
                user_id: approver.user_id,
                type: 'nc_pending_approval',
                title: 'NC aguardando sua aprovação',
                body: `NC "${record.title}" está aguardando aprovação final`,
                project_id: record.project_id,
                action_url: actionUrl,
              });
            }
          }
        }
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) {
        console.error('Failed to insert notifications:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ sent: notifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('nc-notifications error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
