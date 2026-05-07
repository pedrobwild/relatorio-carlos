/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { user, supabaseAdmin } = await authenticateRequest(req);

    // Check staff access
    const { data: isStaff } = await supabaseAdmin.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      return jsonResponse({ error: 'Staff access required' }, 403);
    }

    const { user_id, display_name, email } = await req.json();

    if (!user_id) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    console.log('Updating user:', user_id);

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ display_name, email, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return jsonResponse({ error: profileError.message }, 400);
    }

    // If email changed, also update auth.users
    if (email) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
      if (authError) console.error('Error updating auth email:', authError);
    }

    console.log('User updated successfully:', user_id);
    return jsonResponse({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const authErr = error as { status: number; message: string };
      return jsonResponse({ error: authErr.message }, authErr.status);
    }
    console.error('Unexpected error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
