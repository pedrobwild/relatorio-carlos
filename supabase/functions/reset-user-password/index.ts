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

    const { user_id, new_password } = await req.json();

    if (!user_id) {
      return jsonResponse({ error: 'user_id is required' }, 400);
    }

    if (!new_password || new_password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
    }

    if (user_id === user.id) {
      return jsonResponse({ error: 'Cannot reset your own password through admin panel' }, 400);
    }

    console.log('Resetting password for user:', user_id);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error('Error resetting password:', updateError);
      return jsonResponse({ error: updateError.message }, 400);
    }

    console.log('Password reset successfully for user:', user_id);
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
