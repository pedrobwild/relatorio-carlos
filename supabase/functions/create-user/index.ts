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

    const { email, password, display_name, role, cpf, project_ids } = await req.json();

    if (!email || !password || !role) {
      return jsonResponse({ error: 'Email, password, and role are required' }, 400);
    }

    const validRoles = ['admin', 'engineer', 'customer', 'manager', 'suprimentos', 'financeiro', 'gestor', 'cs'];
    if (!validRoles.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    // Check if user already exists — return their ID so project creation can continue
    const { data: existingUsers } = await supabaseAdmin
      .from('users_profile')
      .select('id, email')
      .eq('email', email)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return jsonResponse({
        success: true,
        already_existed: true,
        user: { id: existingUsers[0].id, email: existingUsers[0].email },
      });
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name || email.split('@')[0],
        role,
        cpf: cpf || null,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      if (createError.message?.includes('already been registered')) {
        return jsonResponse({ error: 'Email já cadastrado no sistema' }, 400);
      }
      return jsonResponse({ error: createError.message }, 400);
    }

    if (!newUser.user) {
      return jsonResponse({ error: 'Falha ao criar usuário' }, 500);
    }

    // Update user_roles if not customer
    if (role !== 'customer') {
      const { error: updateRoleError } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id);
      if (updateRoleError) console.error('Error updating user_roles:', updateRoleError);
    }

    // Update users_profile
    const { error: updateProfileError } = await supabaseAdmin
      .from('users_profile')
      .update({ perfil: role, nome: display_name || email.split('@')[0] })
      .eq('id', newUser.user.id);
    if (updateProfileError) console.error('Error updating users_profile:', updateProfileError);

    // Add user to selected projects
    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
      const projectMemberRecords = project_ids.map((projectId: string) => ({
        project_id: projectId,
        user_id: newUser.user!.id,
        role: 'viewer',
      }));

      const { error: projectMembersError } = await supabaseAdmin
        .from('project_members')
        .insert(projectMemberRecords);
      if (projectMembersError) console.error('Error adding user to projects:', projectMembersError);
    }

    return jsonResponse({
      success: true,
      user: { id: newUser.user?.id, email: newUser.user?.email },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const authErr = error as { status: number; message: string };
      return jsonResponse({ error: authErr.message }, authErr.status);
    }
    console.error('Unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
